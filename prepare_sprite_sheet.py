"""
RN 모바일 앱용 스프라이트 시트 전처리 도구

큰 캐릭터 시트 이미지에서 캐릭터들을 감지한 뒤,
정확한 그리드 구조의 "이미지 1장" 스프라이트 시트로 다시 정리한다.

기본 예시:
    python prepare_sprite_sheet.py --input source.png --output character_sheet.png

3열 x 4행, 64x64 셀 결과:
    output size = 192x256

WebP lossless 결과:
    python prepare_sprite_sheet.py --input source.png --output character_sheet.webp --lossless-webp
"""

from __future__ import annotations

import argparse
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


@dataclass(frozen=True)
class Box:
    """원본 이미지 안에서 캐릭터가 차지하는 영역."""

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


def load_rgba(path: Path) -> Image.Image:
    """입력 이미지를 투명도 처리가 가능한 RGBA로 통일한다."""
    return Image.open(path).convert("RGBA")


def make_foreground_mask(
    image: Image.Image,
    alpha_threshold: int,
    bright_threshold: int,
    saturation_threshold: int,
) -> np.ndarray:
    """
    캐릭터 후보 픽셀을 True로 표시한 mask를 만든다.

    우선 투명도가 있는 이미지는 alpha를 사용한다.
    투명도가 없는 흰 배경 이미지는 밝기/채도 기준으로 배경을 제거한다.
    """
    arr = np.array(image)
    alpha = arr[:, :, 3]

    if np.any(alpha < 250):
        return alpha > alpha_threshold

    rgb = arr[:, :, :3].astype(np.int16)
    max_rgb = np.max(rgb, axis=2)
    min_rgb = np.min(rgb, axis=2)
    saturation = max_rgb - min_rgb

    is_plain_bright_background = (min_rgb > bright_threshold) & (saturation < saturation_threshold)
    return ~is_plain_bright_background


def neighbors(x: int, y: int, width: int, height: int) -> list[tuple[int, int]]:
    """8방향 연결 요소 탐색에 사용할 주변 좌표를 반환한다."""
    points: list[tuple[int, int]] = []

    for ny in range(y - 1, y + 2):
        for nx in range(x - 1, x + 2):
            if nx == x and ny == y:
                continue
            if 0 <= nx < width and 0 <= ny < height:
                points.append((nx, ny))

    return points


def collect_component(
    mask: np.ndarray,
    visited: np.ndarray,
    start_x: int,
    start_y: int,
) -> tuple[Box, int]:
    """하나의 연결된 픽셀 덩어리를 찾아 bbox와 면적을 반환한다."""
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
    """mask 안의 캐릭터 후보 덩어리들을 모두 찾는다."""
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
    """작은 점, 압축 노이즈처럼 캐릭터가 아닌 작은 요소를 제거한다."""
    cleaned = np.zeros_like(mask, dtype=bool)

    for box, area in connected_components(mask):
        if area < min_area:
            continue
        cleaned[box.y1 : box.y2 + 1, box.x1 : box.x2 + 1] |= mask[box.y1 : box.y2 + 1, box.x1 : box.x2 + 1]

    return cleaned


def find_box_in_cell(
    mask: np.ndarray,
    cell_x1: int,
    cell_y1: int,
    cell_x2: int,
    cell_y2: int,
    padding: int,
    min_area: int,
) -> Box:
    """
    한 셀 안에서 캐릭터 bbox를 찾는다.

    이미지 생성 결과처럼 셀 여백이 일정하지 않아도,
    대략적인 3열 x 4행 영역 안에서 실제 캐릭터만 감지한다.
    """
    cell_mask = mask[cell_y1:cell_y2, cell_x1:cell_x2]
    cell_mask = remove_noise(cell_mask, min_area)
    ys, xs = np.nonzero(cell_mask)

    if len(xs) == 0 or len(ys) == 0:
        raise ValueError(f"셀 영역 ({cell_x1}, {cell_y1}, {cell_x2}, {cell_y2})에서 캐릭터를 찾지 못했습니다.")

    return Box(
        x1=max(cell_x1 + int(xs.min()) - padding, cell_x1),
        y1=max(cell_y1 + int(ys.min()) - padding, cell_y1),
        x2=min(cell_x1 + int(xs.max()) + padding, cell_x2 - 1),
        y2=min(cell_y1 + int(ys.max()) + padding, cell_y2 - 1),
    )


def detect_boxes_by_grid(
    mask: np.ndarray,
    columns: int,
    rows: int,
    padding: int,
    min_area: int,
) -> list[Box]:
    """
    원본 이미지를 대략적인 rows x columns 영역으로 나누고,
    각 영역 안에서 실제 캐릭터 bbox를 찾는다.
    """
    height, width = mask.shape
    boxes: list[Box] = []

    for row in range(rows):
        for column in range(columns):
            cell_x1 = round(width * column / columns)
            cell_x2 = round(width * (column + 1) / columns)
            cell_y1 = round(height * row / rows)
            cell_y2 = round(height * (row + 1) / rows)
            boxes.append(find_box_in_cell(mask, cell_x1, cell_y1, cell_x2, cell_y2, padding, min_area))

    return boxes


def crop_with_transparency(image: Image.Image, mask: np.ndarray, box: Box) -> Image.Image:
    """원본에서 캐릭터만 자르고, 감지된 배경 픽셀은 투명 처리한다."""
    cropped = image.crop((box.x1, box.y1, box.x2 + 1, box.y2 + 1)).convert("RGBA")
    cropped_arr = np.array(cropped)
    cropped_mask = mask[box.y1 : box.y2 + 1, box.x1 : box.x2 + 1]
    cropped_arr[:, :, 3] = np.where(cropped_mask, cropped_arr[:, :, 3], 0)
    return Image.fromarray(cropped_arr, "RGBA")


def paste_character(
    output: Image.Image,
    character: Image.Image,
    column: int,
    row: int,
    cell_size: int,
    margin: int,
    align: str,
) -> None:
    """캐릭터 이미지를 지정된 셀 안에 비율 유지로 배치한다."""
    available_size = cell_size - margin * 2
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
    mask: np.ndarray,
    boxes: list[Box],
    columns: int,
    rows: int,
    cell_size: int,
    margin: int,
    align: str,
) -> Image.Image:
    """감지된 캐릭터들을 정확한 rows x columns 스프라이트 시트 1장으로 조립한다."""
    output = Image.new("RGBA", (columns * cell_size, rows * cell_size), (0, 0, 0, 0))

    for index, box in enumerate(boxes):
        row = index // columns
        column = index % columns
        character = crop_with_transparency(image, mask, box)
        paste_character(output, character, column, row, cell_size, margin, align)
        print(f"{index:02d}: row={row}, col={column}, box=({box.x1},{box.y1},{box.x2},{box.y2})")

    return output


def save_debug_boxes(image: Image.Image, boxes: list[Box], output_path: Path) -> None:
    """감지된 bbox를 빨간 선으로 표시한 확인용 이미지를 저장한다."""
    debug = image.copy().convert("RGBA")
    pixels = debug.load()

    for box in boxes:
        for x in range(box.x1, box.x2 + 1):
            pixels[x, box.y1] = (255, 0, 0, 255)
            pixels[x, box.y2] = (255, 0, 0, 255)
        for y in range(box.y1, box.y2 + 1):
            pixels[box.x1, y] = (255, 0, 0, 255)
            pixels[box.x2, y] = (255, 0, 0, 255)

    debug.save(output_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="큰 캐릭터 시트를 RN 앱용 균일 그리드 스프라이트 시트 1장으로 변환합니다."
    )
    parser.add_argument("--input", required=True, type=Path, help="원본 캐릭터 시트 이미지")
    parser.add_argument("--output", required=True, type=Path, help="최종 스프라이트 시트 경로(.png 또는 .webp)")
    parser.add_argument("--columns", default=3, type=int, help="원본/결과 시트의 열 개수")
    parser.add_argument("--rows", default=4, type=int, help="원본/결과 시트의 행 개수") 
    parser.add_argument("--cell-size", default=64, type=int, help="결과 시트의 셀 크기")
    parser.add_argument("--margin", default=2, type=int, help="결과 셀 안쪽 여백")
    parser.add_argument("--align", choices=["bottom", "center", "top"], default="bottom", help="셀 안 캐릭터 정렬")
    parser.add_argument("--alpha-threshold", default=10, type=int, help="투명 배경 감지 임계값")
    parser.add_argument("--bright-threshold", default=235, type=int, help="흰 배경 제거 밝기 임계값")
    parser.add_argument("--saturation-threshold", default=18, type=int, help="흰/회색 배경 제거 채도 임계값")
    parser.add_argument("--min-area", default=40, type=int, help="제거할 작은 노이즈 면적")
    parser.add_argument("--padding", default=2, type=int, help="감지 bbox에 추가할 여백")
    parser.add_argument("--debug-boxes", type=Path, help="감지 영역 확인용 이미지 저장 경로")
    parser.add_argument("--lossless-webp", action="store_true", help="WebP 저장 시 lossless 옵션 사용")
 
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image = load_rgba(args.input)
    mask = make_foreground_mask(
        image,
        alpha_threshold=args.alpha_threshold,
        bright_threshold=args.bright_threshold,
        saturation_threshold=args.saturation_threshold,
    )
    boxes = detect_boxes_by_grid(
        mask,
        columns=args.columns,
        rows=args.rows,
        padding=args.padding,
        min_area=args.min_area,
    )
    sheet = compose_sheet(
        image,
        mask,
        boxes,
        columns=args.columns,
        rows=args.rows,
        cell_size=args.cell_size,
        margin=args.margin,
        align=args.align,
    )

    if args.output.suffix.lower() == ".webp":
        sheet.save(args.output, lossless=args.lossless_webp, quality=100, method=6)
    else:
        sheet.save(args.output)

    if args.debug_boxes is not None:
        save_debug_boxes(image, boxes, args.debug_boxes)

    print(f"완료: {args.output} ({args.columns * args.cell_size}x{args.rows * args.cell_size})")


if __name__ == "__main__":
    main()
