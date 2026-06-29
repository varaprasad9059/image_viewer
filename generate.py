import json
from pathlib import Path

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def find_panorama_files(images_dir: Path) -> list[Path]:
    """Scan the images directory and return supported panorama files."""
    if not images_dir.exists():
        images_dir.mkdir(parents=True, exist_ok=True)

    panorama_files = []
    for path in images_dir.iterdir():
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS:
            panorama_files.append(path)

    return sorted(panorama_files, key=lambda item: item.name.lower())


def generate_manifest(images_dir: Path, output_path: Path) -> int:
    """Create a JSON manifest containing all discovered panorama files."""
    panorama_files = find_panorama_files(images_dir)
    manifest = [path.name for path in panorama_files]
    output_path.write_text(json.dumps(manifest, indent=4), encoding="utf-8")
    return len(manifest)


def main() -> None:
    """Run the manifest generation workflow."""
    base_dir = Path(__file__).resolve().parent
    images_dir = base_dir / "images"
    output_path = base_dir / "panoramas.json"

    count = generate_manifest(images_dir, output_path)
    print(f"Found {count} panorama images.")
    print("panoramas.json generated successfully.")


if __name__ == "__main__":
    main()
