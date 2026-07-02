# -*- coding: utf-8 -*-
"""
project_export_for_ai.py

用途：
    這是一個「專案內容輸出工具」，主要用來協助你把專案資料夾中的
    檔案架構、部分程式碼、完整程式碼輸出成文字檔，方便提供給 AI 助手閱讀。

適用情境：
    1. 想讓 AI 了解目前專案檔案架構。
    2. 想只輸出某個功能資料夾，例如 src/content。
    3. 想只輸出特定副檔名，例如 .js、.css、.json、.md。
    4. 想使用內建範圍快速輸出：
        - 球員相關插件
        - 比賽相關插件
    5. 想先統計輸出範圍的行數與字數，再決定是否真的輸出。
    6. 想避免 node_modules、.git、dist、build 等大型或無意義資料夾被輸出。
    7. 想讓 src/vendor/html2canvas.min.js 保留在專案樹中，
       但不要輸出它的內容，也不要列入行數 / 字數統計。

主要功能：
    1. 顯示功能選單。
    2. 輸出整個專案檔案架構，不包含檔案內容。
    3. 選擇輸出範圍並統計行數 / 字數。
    4. 統計後可選擇是否輸出內容到文字檔。
    5. 支援：
        - 全部可讀文字檔
        - 指定資料夾
        - 指定副檔名
        - 指定檔案清單
        - 內建範圍：球員相關插件 / 比賽相關插件
    6. 自動排除常見不需要輸出的資料夾與二進位檔案。
    7. 輸出內容時永遠忽略 src/vendor/html2canvas.min.js。

使用方式：
    在專案根目錄執行：

        python project_export_for_ai.py

輸出檔案：
    會放在專案根目錄下的：

        ai_exports/

注意：
    本工具只讀取文字檔，不處理圖片、壓縮檔、二進位檔。
"""

from pathlib import Path
from datetime import datetime
import sys


# ============================================================
# 一、基本設定區
# ============================================================

# 取得目前程式所在資料夾，通常也就是你的專案根目錄。
PROJECT_ROOT = Path(__file__).resolve().parent

# 輸出資料夾名稱。
EXPORT_DIR = PROJECT_ROOT / "ai_exports"

# 預設排除的資料夾。
# 這些資料夾通常很大，或者不適合提供給 AI 閱讀。
#
# 注意：
#   這裡會同時影響：
#   - 檔案內容輸出
#   - 行數 / 字數統計
#   - 專案樹輸出
#
# 所以不要把 src/vendor 放進來。
# 因為你希望 src/vendor/html2canvas.min.js 仍然出現在專案樹。
DEFAULT_EXCLUDE_DIRS = {
    ".git",
    ".github",
    ".vscode",
    ".idea",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    ".nuxt",
    ".cache",
    "venv",
    ".venv",
    "env",
    ".env",
    "ai_exports",
}

# 預設排除的檔案名稱。
# 這些檔案會被：
#   - 內容輸出排除
#   - 行數 / 字數統計排除
#
# 但是「專案樹」是否顯示，會由 should_hide_in_tree() 另外判斷。
# 因此 html2canvas.min.js 雖然列在這裡，但專案樹仍可以顯示它。
DEFAULT_EXCLUDE_FILES = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".DS_Store",
    "Thumbs.db",

    # 第三方壓縮檔，內容巨大且不適合給 AI 閱讀。
    # 實際專案仍可保留此檔案。
    # 本工具只是在「內容輸出 / 行數統計」時永遠略過。
    "html2canvas.min.js",
}

# 預設允許輸出的文字副檔名。
# 你可以依專案狀況自行增加。
DEFAULT_TEXT_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".css",
    ".scss",
    ".html",
    ".htm",
    ".md",
    ".txt",
    ".py",
    ".yml",
    ".yaml",
    ".xml",
    ".csv",
    ".toml",
    ".ini",
    ".env.example",
}

# 單一檔案大小上限，避免不小心輸出超大型檔案。
# 預設 1 MB。
MAX_FILE_SIZE_BYTES = 1 * 1024 * 1024


# ============================================================
# 二、內建輸出範圍
# ============================================================
#
# 用途：
#   讓你不用每次手動輸入一堆檔案 / 資料夾。
#
# 注意：
#   這裡只定義「應該輸出的範圍」。
#   實際掃描時仍會套用：
#       - DEFAULT_EXCLUDE_DIRS
#       - DEFAULT_EXCLUDE_FILES
#       - DEFAULT_TEXT_EXTENSIONS
#       - MAX_FILE_SIZE_BYTES

BUILTIN_EXPORT_SCOPES = {
    "player_plugin": {
        "label": "球員相關插件",
        "description": "包含球員技能頁、學校頁、潛力素質、訓練結果、匯出圖片等相關檔案。",
        "paths": [
            "manifest.json",
            "README.md",
            "src/background",
            "src/content/content.js",
            "src/content/content.css",
            "src/content/core",
            "src/content/training",
        ],
    },
    "match_plugin": {
        "label": "比賽相關插件",
        "description": "包含比賽 description 頁、play-by-play 抓取、解析、計算、顯示等相關檔案。",
        "paths": [
            "manifest.json",
            "README.md",
            "src/background",
            "src/content/content.js",
            "src/content/content.css",
            "src/content/core",
            "src/content/match",
        ],
    },
}


# ============================================================
# 三、共用工具函式
# ============================================================

def ensure_export_dir():
    """
    確保輸出資料夾存在。
    如果 ai_exports/ 不存在，就自動建立。
    """
    EXPORT_DIR.mkdir(exist_ok=True)


def now_string():
    """
    產生時間字串，用於輸出檔案名稱。
    例如：20260702_171500
    """
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def normalize_relative_path(path: Path) -> str:
    """
    將絕對路徑轉換成相對於專案根目錄的路徑字串。
    並統一使用 /，方便跨平台與 AI 閱讀。
    """
    return str(path.relative_to(PROJECT_ROOT)).replace("\\", "/")


def is_path_inside_project(path: Path) -> bool:
    """
    判斷指定路徑是否位於專案根目錄內。

    用途：
        防止使用者輸入 ../ 之類的路徑跳出專案資料夾。
    """
    try:
        path.resolve().relative_to(PROJECT_ROOT)
        return True
    except ValueError:
        return False


def is_excluded_dir(path: Path) -> bool:
    """
    判斷資料夾是否應該排除。

    只要路徑中的任何一層資料夾名稱在 DEFAULT_EXCLUDE_DIRS 中，就排除。
    """
    parts = set(path.parts)
    return any(part in DEFAULT_EXCLUDE_DIRS for part in parts)


def is_excluded_file(path: Path) -> bool:
    """
    判斷檔案是否應該在「內容輸出 / 統計」時排除。

    注意：
        這個函式不代表專案樹一定會隱藏該檔案。
        專案樹要不要隱藏，請看 should_hide_in_tree()。
    """
    if path.name in DEFAULT_EXCLUDE_FILES:
        return True

    if is_excluded_dir(path.parent):
        return True

    return False


def is_probably_text_file(path: Path) -> bool:
    """
    判斷檔案是否大概率是文字檔，且適合輸出給 AI。

    判斷方式：
        1. 檔名不在排除名單。
        2. 檔案大小不能超過 MAX_FILE_SIZE_BYTES。
        3. 副檔名在 DEFAULT_TEXT_EXTENSIONS 中。
        4. 或者檔名本身是常見文字設定檔。
    """
    if not path.is_file():
        return False

    if is_excluded_file(path):
        return False

    try:
        size = path.stat().st_size
    except OSError:
        return False

    if size > MAX_FILE_SIZE_BYTES:
        return False

    # 支援 .env.example 這種特殊副檔名 / 檔名。
    if path.name in {".env.example", ".gitignore", ".dockerignore"}:
        return True

    return path.suffix.lower() in DEFAULT_TEXT_EXTENSIONS


def read_text_safely(path: Path) -> str:
    """
    安全讀取文字檔內容。

    優先使用 UTF-8。
    如果失敗，嘗試使用 UTF-8 with BOM。
    再失敗則使用 errors='replace' 避免程式中斷。
    """
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            return path.read_text(encoding="utf-8-sig")
        except UnicodeDecodeError:
            return path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        return f"[讀取失敗：{exc}]"


def count_lines_and_chars(text: str) -> tuple[int, int]:
    """
    計算文字的行數與字數。

    行數：
        使用 splitlines() 計算。
    字數：
        使用 len(text)，包含中文、英文、標點與空白。
    """
    line_count = len(text.splitlines())
    char_count = len(text)
    return line_count, char_count


def pause():
    """
    暫停，等待使用者按 Enter。
    """
    input("\n按 Enter 返回選單...")


def print_header(title: str):
    """
    印出清楚的區塊標題。
    """
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def ask_yes_no(prompt: str, default: bool = False) -> bool:
    """
    詢問使用者 yes/no。

    default:
        True  表示直接 Enter 時視為 yes。
        False 表示直接 Enter 時視為 no。
    """
    default_text = "Y/n" if default else "y/N"

    while True:
        value = input(f"{prompt} ({default_text})：").strip().lower()

        if not value:
            return default

        if value in {"y", "yes", "是", "好"}:
            return True

        if value in {"n", "no", "否", "不要"}:
            return False

        print("請輸入 y 或 n。")


# ============================================================
# 四、掃描檔案與檔案樹
# ============================================================

def get_all_project_files(include_only_text: bool = False) -> list[Path]:
    """
    取得專案中的所有檔案。

    include_only_text:
        True  只回傳可讀文字檔，且會排除 html2canvas.min.js。
        False 回傳所有未被排除的檔案。
    """
    files = []

    for path in PROJECT_ROOT.rglob("*"):
        if not path.is_file():
            continue

        if include_only_text:
            if not is_probably_text_file(path):
                continue
        else:
            if is_excluded_file(path):
                continue

        files.append(path)

    return sorted(files, key=lambda p: normalize_relative_path(p).lower())


def build_file_tree_text() -> str:
    """
    建立整個專案的檔案架構文字。
    只顯示資料夾與檔案名稱，不顯示任何檔案內容。

    注意：
        src/vendor/html2canvas.min.js 會出現在專案樹裡。
        但它不會出現在內容輸出與統計。
    """
    lines = []
    lines.append(f"專案根目錄：{PROJECT_ROOT}")
    lines.append("")
    lines.append("檔案架構：")
    lines.append("")

    def walk_dir(current_dir: Path, prefix: str = ""):
        """
        遞迴走訪資料夾，產生樹狀文字。
        """
        try:
            children = sorted(
                [
                    child for child in current_dir.iterdir()
                    if not should_hide_in_tree(child)
                ],
                key=lambda p: (not p.is_dir(), p.name.lower())
            )
        except PermissionError:
            lines.append(prefix + "[無權限讀取]")
            return

        for index, child in enumerate(children):
            is_last = index == len(children) - 1
            connector = "└── " if is_last else "├── "
            lines.append(prefix + connector + child.name)

            if child.is_dir():
                extension_prefix = "    " if is_last else "│   "
                walk_dir(child, prefix + extension_prefix)

    walk_dir(PROJECT_ROOT)
    return "\n".join(lines)


def should_hide_in_tree(path: Path) -> bool:
    """
    判斷檔案樹輸出時是否要隱藏某個路徑。

    注意：
        這裡故意不使用 DEFAULT_EXCLUDE_FILES。
        因為你希望像 src/vendor/html2canvas.min.js 這類檔案仍出現在專案樹中。

    目前專案樹會隱藏：
        - DEFAULT_EXCLUDE_DIRS 中的資料夾
        - 常見 lock 檔案
        - 系統暫存檔
    """
    if path.is_dir() and path.name in DEFAULT_EXCLUDE_DIRS:
        return True

    # 專案樹中隱藏這些通常沒有結構參考價值的檔案。
    tree_hidden_files = {
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        ".DS_Store",
        "Thumbs.db",
    }

    if path.is_file() and path.name in tree_hidden_files:
        return True

    return False


def export_file_tree():
    """
    功能 2：
    單獨輸出整個資料夾下完整檔案架構。
    僅顯示檔案名稱與資料夾，不顯示任何內容。
    """
    ensure_export_dir()

    tree_text = build_file_tree_text()
    filename = EXPORT_DIR / f"project_file_tree_{now_string()}.txt"

    filename.write_text(tree_text, encoding="utf-8")

    print_header("檔案架構已輸出")
    print(f"輸出檔案：{filename}")
    print("\n預覽：")
    print("-" * 70)

    preview_lines = tree_text.splitlines()[:100]
    print("\n".join(preview_lines))

    if len(tree_text.splitlines()) > 100:
        print("\n...（僅顯示前 100 行預覽）")


# ============================================================
# 五、選擇輸出範圍
# ============================================================

def select_export_scope() -> list[Path]:
    """
    選擇要統計 / 輸出的檔案範圍。

    支援：
        1. 全部可讀文字檔
        2. 指定資料夾
        3. 指定副檔名
        4. 指定檔案路徑清單
        5. 內建範圍
    """
    while True:
        print_header("選擇輸出範圍")
        print("1. 全部可讀文字檔")
        print("2. 指定資料夾")
        print("3. 指定副檔名")
        print("4. 指定檔案路徑清單")
        print("5. 內建範圍：球員相關插件 / 比賽相關插件")
        print("0. 返回主選單")

        choice = input("\n請選擇：").strip()

        if choice == "1":
            return get_all_project_files(include_only_text=True)

        if choice == "2":
            return select_files_by_directory()

        if choice == "3":
            return select_files_by_extensions()

        if choice == "4":
            return select_files_by_file_list()

        if choice == "5":
            return select_files_by_builtin_scope()

        if choice == "0":
            return []

        print("無效選項，請重新輸入。")


def select_files_by_directory() -> list[Path]:
    """
    選擇指定資料夾下的可讀文字檔。
    """
    print("\n請輸入相對於專案根目錄的資料夾路徑。")
    print("例如：src/content")
    folder_input = input("資料夾路徑：").strip().strip('"')

    if not folder_input:
        print("未輸入資料夾。")
        return []

    target_dir = (PROJECT_ROOT / folder_input).resolve()

    if not target_dir.exists() or not target_dir.is_dir():
        print(f"找不到資料夾：{target_dir}")
        return []

    if not is_path_inside_project(target_dir):
        print("不允許讀取專案根目錄以外的資料夾。")
        return []

    files = []

    for path in target_dir.rglob("*"):
        if path.is_file() and is_probably_text_file(path):
            files.append(path)

    return sorted(files, key=lambda p: normalize_relative_path(p).lower())


def select_files_by_extensions() -> list[Path]:
    """
    選擇指定副檔名的檔案。
    """
    print("\n請輸入副檔名，多個用逗號分隔。")
    print("例如：.js,.css,.json")
    ext_input = input("副檔名：").strip()

    if not ext_input:
        print("未輸入副檔名。")
        return []

    extensions = {
        ext.strip().lower() if ext.strip().startswith(".") else "." + ext.strip().lower()
        for ext in ext_input.split(",")
        if ext.strip()
    }

    files = []

    for path in get_all_project_files(include_only_text=True):
        if path.suffix.lower() in extensions:
            files.append(path)

    return sorted(files, key=lambda p: normalize_relative_path(p).lower())


def select_files_by_file_list() -> list[Path]:
    """
    使用者手動輸入多個檔案路徑。
    每行一個，輸入空行結束。
    """
    print("\n請輸入要輸出的檔案路徑，每行一個。")
    print("例如：")
    print("manifest.json")
    print("src/background/background.js")
    print("src/content/content.js")
    print("src/content/content.css")
    print("\n輸入空行結束。")

    files = []

    while True:
        line = input("檔案路徑：").strip().strip('"')

        if not line:
            break

        path = (PROJECT_ROOT / line).resolve()

        if not is_path_inside_project(path):
            print("不允許讀取專案根目錄以外的檔案，已略過。")
            continue

        if not path.exists() or not path.is_file():
            print(f"找不到檔案，已略過：{line}")
            continue

        if not is_probably_text_file(path):
            print(f"不是可讀文字檔、檔案過大或已被設定排除，已略過：{line}")
            continue

        files.append(path)

    return sorted(set(files), key=lambda p: normalize_relative_path(p).lower())


def select_files_by_builtin_scope() -> list[Path]:
    """
    使用內建範圍選擇要輸出的檔案。

    目前內建範圍：
        1. 球員相關插件
        2. 比賽相關插件

    這個功能是為了讓專案輸出給 AI 時更方便，
    不需要每次手動指定一堆檔案路徑。
    """
    print_header("選擇內建輸出範圍")

    scope_keys = list(BUILTIN_EXPORT_SCOPES.keys())

    for index, key in enumerate(scope_keys, start=1):
        scope = BUILTIN_EXPORT_SCOPES[key]
        print(f"{index}. {scope['label']}")
        print(f"   {scope['description']}")

    print("0. 返回上一層")

    choice = input("\n請選擇內建範圍：").strip()

    if choice == "0":
        return []

    if not choice.isdigit():
        print("無效選項。")
        return []

    choice_index = int(choice)

    if choice_index < 1 or choice_index > len(scope_keys):
        print("無效選項。")
        return []

    selected_key = scope_keys[choice_index - 1]
    selected_scope = BUILTIN_EXPORT_SCOPES[selected_key]

    files = collect_files_from_paths(selected_scope["paths"])

    print(f"\n已選擇：{selected_scope['label']}")
    print(f"檔案數：{len(files)}")

    return files


def collect_files_from_paths(relative_paths: list[str]) -> list[Path]:
    """
    從多個相對路徑收集可輸出的文字檔。

    relative_paths 可以包含：
        - 單一檔案，例如 manifest.json
        - 資料夾，例如 src/content/core

    回傳：
        已排序且去重後的 Path 清單。
    """
    collected_files = []

    for relative_path in relative_paths:
        target = (PROJECT_ROOT / relative_path).resolve()

        if not is_path_inside_project(target):
            print(f"不允許讀取專案根目錄以外的路徑，已略過：{relative_path}")
            continue

        if not target.exists():
            print(f"路徑不存在，已略過：{relative_path}")
            continue

        if target.is_file():
            if is_probably_text_file(target):
                collected_files.append(target)
            else:
                print(f"不是可輸出的文字檔或已被設定排除，已略過：{relative_path}")
            continue

        if target.is_dir():
            for path in target.rglob("*"):
                if path.is_file() and is_probably_text_file(path):
                    collected_files.append(path)

    unique_files = sorted(
        set(collected_files),
        key=lambda p: normalize_relative_path(p).lower()
    )

    return unique_files


# ============================================================
# 六、統計與輸出內容
# ============================================================

def calculate_files_stats(files: list[Path]) -> dict:
    """
    計算選定檔案範圍的統計資訊。

    回傳：
        {
            "file_count": 檔案數,
            "total_lines": 總行數,
            "total_chars": 總字數,
            "files": [
                {
                    "path": Path,
                    "relative_path": str,
                    "lines": int,
                    "chars": int
                }
            ]
        }
    """
    stats = {
        "file_count": 0,
        "total_lines": 0,
        "total_chars": 0,
        "files": []
    }

    for path in files:
        if not is_probably_text_file(path):
            continue

        text = read_text_safely(path)
        line_count, char_count = count_lines_and_chars(text)

        item = {
            "path": path,
            "relative_path": normalize_relative_path(path),
            "lines": line_count,
            "chars": char_count
        }

        stats["files"].append(item)
        stats["file_count"] += 1
        stats["total_lines"] += line_count
        stats["total_chars"] += char_count

    return stats


def print_stats(stats: dict):
    """
    將統計資訊顯示在終端機。
    """
    print_header("選定範圍統計結果")
    print(f"檔案數：{stats['file_count']}")
    print(f"總行數：{stats['total_lines']}")
    print(f"總字數：{stats['total_chars']}")

    print("\n檔案明細：")
    print("-" * 70)

    for item in stats["files"]:
        print(
            f"{item['relative_path']} "
            f"| 行數：{item['lines']} "
            f"| 字數：{item['chars']}"
        )


def build_content_export_text(files: list[Path], stats: dict) -> str:
    """
    建立輸出給 AI 閱讀的完整文字內容。

    格式包含：
        1. 專案資訊
        2. 統計資訊
        3. 檔案清單
        4. 每個檔案的完整內容

    注意：
        src/vendor/html2canvas.min.js 會被 is_probably_text_file() 排除，
        所以不會出現在內容輸出中。
    """
    lines = []

    lines.append("# Project Export For AI")
    lines.append("")
    lines.append(f"產生時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"專案根目錄：{PROJECT_ROOT}")
    lines.append("")
    lines.append("## 統計資訊")
    lines.append("")
    lines.append(f"- 檔案數：{stats['file_count']}")
    lines.append(f"- 總行數：{stats['total_lines']}")
    lines.append(f"- 總字數：{stats['total_chars']}")
    lines.append("")
    lines.append("## 檔案清單")
    lines.append("")

    for item in stats["files"]:
        lines.append(
            f"- {item['relative_path']} "
            f"(行數：{item['lines']}，字數：{item['chars']})"
        )

    lines.append("")
    lines.append("## 檔案內容")
    lines.append("")

    for path in files:
        if not is_probably_text_file(path):
            continue

        relative_path = normalize_relative_path(path)
        text = read_text_safely(path)

        lines.append("")
        lines.append("=" * 90)
        lines.append(f"FILE: {relative_path}")
        lines.append("=" * 90)
        lines.append("")
        lines.append(text)
        lines.append("")

    return "\n".join(lines)


def export_selected_files_content(files: list[Path], stats: dict):
    """
    將選定範圍的檔案內容輸出成文字檔。
    """
    ensure_export_dir()

    filename = EXPORT_DIR / f"project_content_export_{now_string()}.txt"
    output_text = build_content_export_text(files, stats)

    filename.write_text(output_text, encoding="utf-8")

    print_header("內容已輸出")
    print(f"輸出檔案：{filename}")
    print(f"檔案數：{stats['file_count']}")
    print(f"總行數：{stats['total_lines']}")
    print(f"總字數：{stats['total_chars']}")


def run_stats_and_optional_export():
    """
    功能 3 + 功能 5：
        1. 先選擇範圍。
        2. 計算行數與字數。
        3. 顯示統計。
        4. 詢問是否要輸出內容。
    """
    files = select_export_scope()

    if not files:
        print("沒有選到任何檔案。")
        return

    stats = calculate_files_stats(files)
    print_stats(stats)

    should_export = ask_yes_no("\n是否要將上述範圍的檔案內容輸出成文字檔？", default=False)

    if should_export:
        export_selected_files_content(files, stats)
    else:
        print("已取消輸出內容。")


# ============================================================
# 七、顯示可用指令與選單
# ============================================================

def show_help():
    """
    顯示本工具的功能說明。
    """
    print_header("功能說明")

    print("""
本工具是給 AI 助手閱讀專案用的輸出工具。

可用功能：

1. 輸出完整檔案架構
   - 掃描整個專案資料夾。
   - 只顯示資料夾與檔案名稱。
   - 不輸出任何檔案內容。
   - 適合先讓 AI 了解專案架構。
   - src/vendor/html2canvas.min.js 會出現在專案樹中。

2. 統計並選擇性輸出檔案內容
   - 可選擇全部可讀文字檔。
   - 可選擇指定資料夾。
   - 可選擇指定副檔名。
   - 可手動指定檔案清單。
   - 可選擇內建範圍：
       1. 球員相關插件
       2. 比賽相關插件
   - 先計算行數與字數。
   - 顯示統計後，再詢問是否輸出成文字檔。

3. 顯示功能說明
   - 顯示目前有哪些功能可以使用。

4. 離開程式

預設排除資料夾：
   .git, node_modules, dist, build, coverage, venv, .venv,
   __pycache__, .vscode, .idea, ai_exports 等。

預設支援文字檔：
   .js, .json, .css, .html, .md, .txt, .py, .yml, .yaml,
   .xml, .csv, .toml, .ini 等。

內容輸出與統計永遠忽略：
   src/vendor/html2canvas.min.js

原因：
   這是第三方壓縮檔，內容巨大，不適合給 AI 閱讀。
   但它仍會顯示在專案樹中，方便了解專案結構。

輸出位置：
   ai_exports/
""")


def main_menu():
    """
    主選單。
    使用者可以透過選單模式執行所有功能。
    """
    ensure_export_dir()

    while True:
        print_header("Project Export For AI - 主選單")
        print(f"專案根目錄：{PROJECT_ROOT}")
        print("")
        print("1. 輸出完整檔案架構（只顯示檔名，不顯示內容）")
        print("2. 統計選定範圍行數 / 字數，並可選擇輸出內容")
        print("3. 顯示功能說明")
        print("0. 離開")

        choice = input("\n請選擇功能：").strip()

        if choice == "1":
            export_file_tree()
            pause()

        elif choice == "2":
            run_stats_and_optional_export()
            pause()

        elif choice == "3":
            show_help()
            pause()

        elif choice == "0":
            print("程式結束。")
            break

        else:
            print("無效選項，請重新輸入。")


# ============================================================
# 八、程式入口
# ============================================================

if __name__ == "__main__":
    try:
        main_menu()
    except KeyboardInterrupt:
        print("\n\n使用者中斷，程式結束。")
        sys.exit(0)
