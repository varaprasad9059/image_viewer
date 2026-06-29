# 360Viewer

360Viewer is a lightweight, modern panorama browser built with HTML, CSS, JavaScript, and Python. It uses Pannellum to display equirectangular 360° images and includes search, keyboard controls, fullscreen support, and local storage for the last viewed panorama.

## Features

- Browse panorama images from the images folder
- Search panoramas live
- Navigate with previous/next controls
- Use keyboard shortcuts for navigation and fullscreen
- Display a dark, responsive, professional viewer interface
- Remember the last opened panorama in the browser

## Installation

1. Place your panorama images in the images folder.
2. Run the Python manifest generator:

```bash
python generate.py
```

3. Start a local server from the project folder:

```bash
python -m http.server 8000
```

4. Open your browser at:

```text
http://localhost:8000/
```

## How to add images

Put your supported panorama files into the images folder. Supported formats are:

- .jpg
- .jpeg
- .png
- .webp

After adding or removing files, run:

```bash
python generate.py
```

## How to run generate.py

From the project root:

```bash
python generate.py
```

The script scans the images folder, sorts the panorama files alphabetically, and creates panoramas.json.

## Troubleshooting

- If the viewer is empty, make sure your image files are in the images folder and that you ran generate.py.
- If the panorama does not load, confirm that the filename is correct and that the file is a valid image.
- If you change images while the page is open, refresh the browser to reload the manifest.
