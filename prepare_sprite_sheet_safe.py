"""
Safe sprite-sheet post processor.

This file is intentionally separate from prepare_sprite_sheet.py.

Example:
    python prepare_sprite_sheet_safe.py --input assets/sprite/Gemini_15.png --output assets/sprite/gemini_sheet_safe.png

3 columns x 4 rows, 64x64 cells:
    output size = 192x256

Keep the character smaller inside each output cell:
    python prepare_sprite_sheet_safe.py --input source.png --output out.png --cell-size 64 --fit-size 56
"""

from __future__ import annotations

import argparse
from collections import Counter, deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass(frozen=True)
class Box:
    """Inclusive pixel bounds."""

    x1: int
    y1: int
    x2: int
    y2: int

    @property
    def width(self) -> int:
        return self.x2 - self.x1 + 1

    @property
    def height(self) -> int:
        return self.y2 - self.y1 + 1


@dataclass(frozen=True)
class Frame:
    """A detected character inside one source grid cell."""

    cell: Box
    character: Box
    cell_mask: np.ndarray


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def neighbors(x: int, y: int, width: int, height: int) -> list[tuple[int, int]]:
    points: list[tuple[int, int]] = []

    for ny in range(y - 1, y + 2):
        for nx in range(x - 1, x + 2):
            if nx == x and ny == y:
                continue
            if 0 <= nx < width and 0 <= ny < height:
                points.append((nx, ny))

    return points


def collect_component(mask: np.ndarray, visited: np.ndarray, start_x: int, start_y: int) -> tuple[Box, int]:
    height, width = mask.shape
    queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
    visited[start_y, start_x] = True
    min_x = max_x = start_x
    min_y = max_y = start_y
    area = 0

    while queue:
        x, y = queue.popleft()
        area += 1
        min_x = min(min_x, x)
        max_x = max(max_x, x)
        min_y = min(min_y, y)
        max_y = max(max_y, y)

        for nx, ny in neighbors(x, y, width, height):
            if visited[ny, nx] or not mask[ny, nx]:
                continue
            visited[ny, nx] = True
            queue.append((nx, ny))

    return Box(min_x, min_y, max_x, max_y), area


def connected_components(mask: np.ndarray) -> list[tuple[Box, int]]:
    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    components: list[tuple[Box, int]] = []

    for y in range(height):
        for x in range(width):
            if visited[y, x] or not mask[y, x]:
                continue
            components.append(collect_component(mask, visited, x, y))

    return components


def remove_noise(mask: np.ndarray, min_area: int) -> np.ndarray:
    cleaned = np.zeros_like(mask, dtype=bool)

    for box, area in connected_components(mask):
        if area < min_area:
            continue
        cleaned[box.y1 : box.y2 + 1, box.x1 : box.x2 + 1] |= mask[box.y1 : box.y2 + 1, box.x1 : box.x2 + 1]

    return cleaned


def dominant_border_colors(rgb: np.ndarray, max_colors: int, bucket_size: int) -> np.ndarray:
    height, width, _ = rgb.shape
    border = np.concatenate(
        [
            rgb[0, :, :],
            rgb[height - 1, :, :],
            rgb[:, 0, :],
            rgb[:, width - 1, :],
        ],
        axis=0,
    )
    quantized = (border // bucket_size) * bucket_size
    counts = Counter(map(tuple, quantized.tolist()))
    colors = [tuple(min(255, channel + bucket_size // 2) for channel in color) for color, _ in counts.most_common(max_colors)]
    return np.array(colors, dtype=np.int16)


def background_candidates_from_border(
    rgb: np.ndarray,
    max_colors: int,
    bucket_size: int,
    tolerance: int,
) -> np.ndarray:
    palette = dominant_border_colors(rgb, max_colors=max_colors, bucket_size=bucket_size)
    rgb_i16 = rgb.astype(np.int16)
    candidates = np.zeros(rgb.shape[:2], dtype=bool)

    for color in palette:
        distance = np.abs(rgb_i16 - color).sum(axis=2)
        candidates |= distance <= tolerance

    return candidates


def enqueue_background_pixel(
    candidate_mask: np.ndarray,
    background: np.ndarray,
    queue: deque[tuple[int, int]],
    x: int,
    y: int,
) -> None:
    if not candidate_mask[y, x] or background[y, x]:
        return

    background[y, x] = True
    queue.append((x, y))


def seed_background_from_edges(
    candidate_mask: np.ndarray,
    background: np.ndarray,
    queue: deque[tuple[int, int]],
) -> None:
    height, width = candidate_mask.shape

    for x in range(width):
        for y in (0, height - 1):
            enqueue_background_pixel(candidate_mask, background, queue, x, y)

    for y in range(height):
        for x in (0, width - 1):
            enqueue_background_pixel(candidate_mask, background, queue, x, y)


def flood_background(candidate_mask: np.ndarray) -> np.ndarray:
    height, width = candidate_mask.shape
    background = np.zeros_like(candidate_mask, dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    seed_background_from_edges(candidate_mask, background, queue)

    while queue:
        x, y = queue.popleft()
        for nx, ny in neighbors(x, y, width, height):
            enqueue_background_pixel(candidate_mask, background, queue, nx, ny)

    return background


def make_cell_foreground_mask(
    cell_image: Image.Image,
    alpha_threshold: int,
    background_tolerance: int,
    max_background_colors: int,
    bucket_size: int,
    min_area: int,
) -> np.ndarray:
    arr = np.array(cell_image.convert("RGBA"))
    alpha = arr[:, :, 3]

    if np.any(alpha < 250):
        mask = alpha > alpha_threshold
    else:
        rgb = arr[:, :, :3]
        candidate_background = background_candidates_from_border(
            rgb,
            max_colors=max_background_colors,
            bucket_size=bucket_size,
            tolerance=background_tolerance,
        )
        mask = ~flood_background(candidate_background)

    return remove_noise(mask, min_area=min_area)


def detect_frames_by_grid(
    image: Image.Image,
    columns: int,
    rows: int,
    padding: int,
    min_area: int,
    alpha_threshold: int,
    background_tolerance: int,
    max_background_colors: int,
    bucket_size: int,
) -> list[Frame]:
    width, height = image.size
    frames: list[Frame] = []

    for row in range(rows):
        for column in range(columns):
            cell_x1 = round(width * column / columns)
            cell_x2 = round(width * (column + 1) / columns)
            cell_y1 = round(height * row / rows)
            cell_y2 = round(height * (row + 1) / rows)
            cell = Box(cell_x1, cell_y1, cell_x2 - 1, cell_y2 - 1)
            cell_image = image.crop((cell_x1, cell_y1, cell_x2, cell_y2))
            cell_mask = make_cell_foreground_mask(
                cell_image,
                alpha_threshold=alpha_threshold,
                background_tolerance=background_tolerance,
                max_background_colors=max_background_colors,
                bucket_size=bucket_size,
                min_area=min_area,
            )
            ys, xs = np.nonzero(cell_mask)

            if len(xs) == 0 or len(ys) == 0:
                raise ValueError(f"셀 ({row}, {column})에서 캐릭터를 찾지 못했습니다.")

            character = Box(
                x1=max(cell.x1 + int(xs.min()) - padding, cell.x1),
                y1=max(cell.y1 + int(ys.min()) - padding, cell.y1),
                x2=min(cell.x1 + int(xs.max()) + padding, cell.x2),
                y2=min(cell.y1 + int(ys.max()) + padding, cell.y2),
            )
            frames.append(Frame(cell=cell, character=character, cell_mask=cell_mask))

    return frames


def crop_frame_with_transparency(image: Image.Image, frame: Frame) -> Image.Image:
    box = frame.character
    cropped = image.crop((box.x1, box.y1, box.x2 + 1, box.y2 + 1)).convert("RGBA")
    cropped_arr = np.array(cropped)

    mask_x1 = box.x1 - frame.cell.x1
    mask_x2 = box.x2 - frame.cell.x1 + 1
    mask_y1 = box.y1 - frame.cell.y1
    mask_y2 = box.y2 - frame.cell.y1 + 1
    cropped_mask = frame.cell_mask[mask_y1:mask_y2, mask_x1:mask_x2]
    cropped_arr[:, :, 3] = np.where(cropped_mask, cropped_arr[:, :, 3], 0)

    return Image.fromarray(cropped_arr, "RGBA")


def paste_character(
    output: Image.Image,
    character: Image.Image,
    column: int,
    row: int,
    cell_size: int,
    margin: int,
    fit_size: int | None,
    align: str,
) -> None:
    available_size = cell_size - margin * 2
    if fit_size is not None:
        available_size = min(available_size, fit_size)

    width, height = character.size
    scale = min(available_size / width, available_size / height)
    new_w = max(1, int(width * scale))
    new_h = max(1, int(height * scale))
    resized = character.resize((new_w, new_h), Image.NEAREST)

    slot_x = column * cell_size
    slot_y = row * cell_size
    paste_x = slot_x + (cell_size - new_w) // 2

    if align == "center":
        paste_y = slot_y + (cell_size - new_h) // 2
    elif align == "top":
        paste_y = slot_y + margin
    else:
        paste_y = slot_y + cell_size - margin - new_h

    output.paste(resized, (paste_x, paste_y), resized)


def compose_sheet(
    image: Image.Image,
    frames: list[Frame],
    columns: int,
    rows: int,
    cell_size: int,
    margin: int,
    fit_size: int | None,
    align: str,
) -> Image.Image:
    output = Image.new("RGBA", (columns * cell_size, rows * cell_size), (0, 0, 0, 0))

    for index, frame in enumerate(frames):
        row = index // columns
        column = index % columns
        character = crop_frame_with_transparency(image, frame)
        paste_character(output, character, column, row, cell_size, margin, fit_size, align)
        print(
            f"{index:02d}: row={row}, col={column}, "
            f"box=({frame.character.x1},{frame.character.y1},{frame.character.x2},{frame.character.y2})"
        )

    return output


def save_debug_boxes(image: Image.Image, frames: list[Frame], output_path: Path) -> None:
    debug = image.copy().convert("RGBA")
    pixels = debug.load()

    for frame in frames:
        box = frame.character
        for x in range(box.x1, box.x2 + 1):
            pixels[x, box.y1] = (255, 0, 0, 255)
            pixels[x, box.y2] = (255, 0, 0, 255)
        for y in range(box.y1, box.y2 + 1):
            pixels[box.x1, y] = (255, 0, 0, 255)
            pixels[box.x2, y] = (255, 0, 0, 255)

    debug.save(output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="3x4/4x1 캐릭터 이미지를 안전하게 균일한 스프라이트 시트로 변환합니다."
    )
    parser.add_argument("--input", required=True, type=Path, help="원본 캐릭터 시트 이미지")
    parser.add_argument("--output", required=True, type=Path, help="최종 스프라이트 시트 경로(.png 또는 .webp)")
    parser.add_argument("--columns", default=3, type=int, help="원본/결과 시트의 열 개수")
    parser.add_argument("--rows", default=4, type=int, help="원본/결과 시트의 행 개수")
    parser.add_argument("--cell-size", default=64, type=int, help="결과 시트의 셀 크기")
    parser.add_argument("--fit-size", type=int, help="캐릭터가 차지할 최대 크기. 예: 64셀에는 56, 128셀에는 80")
    parser.add_argument("--margin", default=2, type=int, help="결과 셀 안쪽 최소 여백")
    parser.add_argument("--align", choices=["bottom", "center", "top"], default="bottom", help="셀 안 캐릭터 정렬")
    parser.add_argument("--alpha-threshold", default=10, type=int, help="투명 배경 감지 임계값")
    parser.add_argument("--background-tolerance", default=42, type=int, help="테두리 배경색과 같은 픽셀로 볼 색상 거리")
    parser.add_argument("--max-background-colors", default=6, type=int, help="테두리에서 배경 후보로 사용할 대표 색상 개수")
    parser.add_argument("--bucket-size", default=16, type=int, help="배경 대표색 추출용 색상 단순화 크기")
    parser.add_argument("--min-area", default=40, type=int, help="제거할 작은 노이즈 면적")
    parser.add_argument("--padding", default=2, type=int, help="감지 bbox에 추가할 여백")
    parser.add_argument("--debug-boxes", type=Path, help="감지 영역 확인용 이미지 저장 경로")
    parser.add_argument("--lossless-webp", action="store_true", help="WebP 저장 시 lossless 옵션 사용")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image = load_rgba(args.input)
    frames = detect_frames_by_grid(
        image,
        columns=args.columns,
        rows=args.rows,
        padding=args.padding,
        min_area=args.min_area,
        alpha_threshold=args.alpha_threshold,
        background_tolerance=args.background_tolerance,
        max_background_colors=args.max_background_colors,
        bucket_size=args.bucket_size,
    )
    sheet = compose_sheet(
        image,
        frames,
        columns=args.columns,
        rows=args.rows,
        cell_size=args.cell_size,
        margin=args.margin,
        fit_size=args.fit_size,
        align=args.align,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)

    if args.output.suffix.lower() == ".webp":
        sheet.save(args.output, lossless=args.lossless_webp, quality=100, method=6)
    else:
        sheet.save(args.output)

    if args.debug_boxes is not None:
        args.debug_boxes.parent.mkdir(parents=True, exist_ok=True)
        save_debug_boxes(image, frames, args.debug_boxes)

    print(f"완료: {args.output} ({args.columns * args.cell_size}x{args.rows * args.cell_size})")


if __name__ == "__main__":
    main()
