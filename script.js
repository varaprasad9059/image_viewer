const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const STORAGE_KEY = "360viewer-last-panorama";

const elements = {
  searchInput: document.getElementById("search-input"),
  panoramaList: document.getElementById("panorama-list"),
  panoramaCount: document.getElementById("panorama-count"),
  selectionIndicator: document.getElementById("selection-indicator"),
  viewerTitle: document.getElementById("viewer-title"),
  prevButton: document.getElementById("prev-btn"),
  nextButton: document.getElementById("next-btn"),
  fullscreenButton: document.getElementById("fullscreen-btn"),
  loadingOverlay: document.getElementById("loading-overlay"),
  viewerError: document.getElementById("viewer-error"),
  panoramaViewer: document.getElementById("panorama"),
  dropZone: document.getElementById("drop-zone"),
  browseFolderButton: document.getElementById("browse-folder-btn"),
  folderInput: document.getElementById("folder-input")
};

const state = {
  panoramas: [],
  filteredPanoramas: [],
  currentIndex: -1,
  currentPanorama: null,
  viewer: null,
  isLoading: false,
  isUsingDroppedFolder: false
};

function init() {
  attachEventListeners();
  loadPanoramas();
}

function attachEventListeners() {
  elements.searchInput.addEventListener("input", handleSearchInput);
  elements.prevButton.addEventListener("click", () => navigatePanorama(-1));
  elements.nextButton.addEventListener("click", () => navigatePanorama(1));
  elements.fullscreenButton.addEventListener("click", toggleFullscreen);
  elements.panoramaList.addEventListener("click", handlePanoramaListClick);
  elements.browseFolderButton.addEventListener("click", () => elements.folderInput.click());
  elements.folderInput.addEventListener("change", handleFolderSelection);
  elements.dropZone.addEventListener("dragenter", handleDragEnter);
  elements.dropZone.addEventListener("dragover", handleDragOver);
  elements.dropZone.addEventListener("dragleave", handleDragLeave);
  elements.dropZone.addEventListener("drop", handleDrop);
  document.addEventListener("keydown", handleKeyboardShortcuts);
  document.addEventListener("fullscreenchange", updateFullscreenButtonLabel);
}

async function loadPanoramas() {
  try {
    const response = await fetch("panoramas.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Could not load panoramas.json (${response.status})`);
    }

    const data = await response.json();
    const manifestImages = Array.isArray(data) ? data : [];
    state.panoramas = manifestImages.map((imageName) => ({
      name: imageName,
      src: `images/${encodeURI(imageName)}`,
      isLocalFile: false
    }));
    state.filteredPanoramas = [...state.panoramas];
    state.isUsingDroppedFolder = false;
    renderPanoramaList();
    updateSummary();

    const rememberedImage = localStorage.getItem(STORAGE_KEY);
    const rememberedIndex = state.panoramas.findIndex((panorama) => panorama.name === rememberedImage);

    if (state.panoramas.length > 0) {
      const initialIndex = rememberedIndex >= 0 ? rememberedIndex : 0;
      selectPanorama(initialIndex, { skipStorage: true });
    } else {
      elements.viewerTitle.textContent = "Drop a folder of panoramas";
      hideError();
      elements.panoramaList.innerHTML = "<div class=\"empty-state\">No panorama files are available yet. Drop a folder of images to start.</div>";
    }
  } catch (error) {
    console.error(error);
    elements.viewerTitle.textContent = "Drop a folder of panoramas";
    elements.panoramaList.innerHTML = "<div class=\"empty-state\">No panorama files are available yet. Drop a folder of images to start.</div>";
  }
}

function handleSearchInput(event) {
  const query = event.target.value.trim().toLowerCase();
  state.filteredPanoramas = state.panoramas.filter((panorama) =>
    panorama.name.toLowerCase().includes(query)
  );
  renderPanoramaList();
}

function handlePanoramaListClick(event) {
  const itemButton = event.target.closest(".panorama-item");
  if (!itemButton) {
    return;
  }

  const imageName = itemButton.dataset.name;
  const index = state.panoramas.findIndex((panorama) => panorama.name === imageName);
  if (index >= 0) {
    selectPanorama(index);
  }
}

function renderPanoramaList() {
  if (state.filteredPanoramas.length === 0) {
    elements.panoramaList.innerHTML = "<div class=\"empty-state\">No panorama files match your search.</div>";
    return;
  }

  const markup = state.filteredPanoramas
    .map((panorama) => {
      const isActive = state.currentPanorama && panorama.name === state.currentPanorama.name;
      return `
        <button class="panorama-item ${isActive ? "active" : ""}" data-name="${panorama.name}">
          <strong>${panorama.name}</strong>
          <small>${isActive ? "Currently selected" : "Click to view"}</small>
        </button>
      `;
    })
    .join("");

  elements.panoramaList.innerHTML = markup;

  const activeButton = elements.panoramaList.querySelector(".panorama-item.active");
  if (activeButton) {
    activeButton.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function updateSummary() {
  elements.panoramaCount.textContent = `${state.panoramas.length} panorama${state.panoramas.length === 1 ? "" : "s"}`;
  elements.selectionIndicator.textContent = state.currentIndex >= 0 ? `${state.currentIndex + 1} / ${state.panoramas.length}` : "No selection";
}

function selectPanorama(index, options = {}) {
  if (!state.panoramas[index]) {
    return;
  }

  const selectedPanorama = state.panoramas[index];
  if (state.currentIndex === index && state.currentPanorama && state.currentPanorama.name === selectedPanorama.name && state.viewer) {
    return;
  }

  state.currentIndex = index;
  state.currentPanorama = selectedPanorama;
  elements.viewerTitle.textContent = selectedPanorama.name;
  updateSummary();
  renderPanoramaList();

  if (!options.skipStorage) {
    localStorage.setItem(STORAGE_KEY, selectedPanorama.name);
  }

  loadCurrentPanorama();
}

function loadCurrentPanorama() {
  if (!state.currentPanorama) {
    return;
  }

  if (state.isLoading) {
    return;
  }

  state.isLoading = true;
  showLoading();
  hideError();

  const imagePath = state.currentPanorama.src;
  const imageLoader = new Image();

  imageLoader.onload = () => {
    if (!state.currentPanorama || state.currentPanorama.name !== state.panoramas[state.currentIndex]?.name) {
      return;
    }

    if (typeof pannellum === "undefined" || !pannellum.viewer) {
      hideLoading();
      state.isLoading = false;
      showError("Pannellum could not be loaded. Please check your connection.");
      return;
    }

    if (state.viewer) {
      state.viewer.destroy();
    }

    state.viewer = pannellum.viewer("panorama", {
      type: "equirectangular",
      panorama: imagePath,
      autoLoad: true,
      showControls: true,
      compass: false,
      autoRotate: 0,
      hfov: 100
    });

    hideLoading();
    state.isLoading = false;
  };

  imageLoader.onerror = () => {
    if (!state.currentPanorama || state.currentPanorama.name !== state.panoramas[state.currentIndex]?.name) {
      return;
    }

    hideLoading();
    state.isLoading = false;
    showError(`Unable to load ${state.currentPanorama.name}. Check that the file exists and is a valid image.`);
  };

  imageLoader.src = imagePath;
}

function navigatePanorama(step) {
  if (!state.panoramas.length) {
    return;
  }

  const nextIndex = state.currentIndex >= 0
    ? (state.currentIndex + step + state.panoramas.length) % state.panoramas.length
    : 0;

  selectPanorama(nextIndex);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      showError("Fullscreen could not be entered.");
    });
  } else {
    document.exitFullscreen();
  }
}

function updateFullscreenButtonLabel() {
  elements.fullscreenButton.textContent = document.fullscreenElement ? "⤡ Exit Fullscreen" : "⛶ Fullscreen";
}

function handleKeyboardShortcuts(event) {
  const isTyping = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (isTyping) {
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      navigatePanorama(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      navigatePanorama(1);
      break;
    case "f":
    case "F":
      event.preventDefault();
      toggleFullscreen();
      break;
    case "Home":
      event.preventDefault();
      if (state.panoramas.length) {
        selectPanorama(0);
      }
      break;
    case "End":
      event.preventDefault();
      if (state.panoramas.length) {
        selectPanorama(state.panoramas.length - 1);
      }
      break;
    default:
      break;
  }
}

function handleDragEnter(event) {
  event.preventDefault();
  elements.dropZone.classList.add("drag-over");
}

function handleDragOver(event) {
  event.preventDefault();
  elements.dropZone.classList.add("drag-over");
}

function handleDragLeave(event) {
  event.preventDefault();
  if (!elements.dropZone.contains(event.relatedTarget)) {
    elements.dropZone.classList.remove("drag-over");
  }
}

function handleDrop(event) {
  event.preventDefault();
  elements.dropZone.classList.remove("drag-over");

  const items = event.dataTransfer?.items;
  if (!items || !items.length) {
    showError("Drop a folder containing supported image files.");
    return;
  }

  const entries = Array.from(items)
    .map((item) => (item.webkitGetAsEntry ? item.webkitGetAsEntry() : null))
    .filter(Boolean);

  const directoryEntry = entries.find((entry) => entry.isDirectory);
  if (!directoryEntry) {
    showError("Please drop a folder rather than individual files.");
    return;
  }

  loadDroppedFolder(directoryEntry);
}

function handleFolderSelection(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const imageFiles = files.filter((file) => isSupportedImage(file.name));
  if (!imageFiles.length) {
    showError("No supported image files were found in that folder.");
    return;
  }

  loadDroppedFiles(imageFiles);
  event.target.value = "";
}

function loadDroppedFolder(directoryEntry) {
  showLoading();
  collectFilesFromEntry(directoryEntry)
    .then((files) => {
      const imageFiles = files.filter((file) => isSupportedImage(file.name));
      if (!imageFiles.length) {
        hideLoading();
        showError("No supported image files were found in that folder.");
        return;
      }

      loadDroppedFiles(imageFiles);
    })
    .catch((error) => {
      console.error(error);
      hideLoading();
      showError("The selected folder could not be read. Please try again.");
    });
}

function loadDroppedFiles(files) {
  revokeObjectUrls();

  const panoramas = files
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((file) => ({
      name: file.name,
      src: URL.createObjectURL(file),
      isLocalFile: true
    }));

  state.panoramas = panoramas;
  state.filteredPanoramas = [...state.panoramas];
  state.currentIndex = -1;
  state.currentPanorama = null;
  state.isUsingDroppedFolder = true;
  renderPanoramaList();
  updateSummary();
  hideError();
  hideLoading();

  if (state.panoramas.length) {
    selectPanorama(0, { skipStorage: true });
  } else {
    showError("No supported panorama files were found.");
  }
}

function revokeObjectUrls() {
  state.panoramas.forEach((panorama) => {
    if (panorama.isLocalFile && panorama.src.startsWith("blob:")) {
      URL.revokeObjectURL(panorama.src);
    }
  });
}

function collectFilesFromEntry(entry) {
  if (!entry) {
    return Promise.resolve([]);
  }

  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file((file) => resolve([file]), reject);
    });
  }

  if (!entry.isDirectory) {
    return Promise.resolve([]);
  }

  const reader = entry.createReader();
  return readAllDirectoryEntries(reader).then((entries) => {
    return Promise.all(entries.map((child) => collectFilesFromEntry(child))).then((fileGroups) => fileGroups.flat());
  });
}

function readAllDirectoryEntries(reader) {
  return new Promise((resolve, reject) => {
    const collectedEntries = [];

    const readNextBatch = () => {
      reader.readEntries((entries) => {
        if (!entries.length) {
          resolve(collectedEntries);
          return;
        }

        collectedEntries.push(...entries);
        readNextBatch();
      }, reject);
    };

    readNextBatch();
  });
}

function isSupportedImage(fileName) {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function showLoading() {
  elements.loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  elements.loadingOverlay.classList.add("hidden");
}

function showError(message) {
  elements.viewerError.textContent = message;
  elements.viewerError.classList.remove("hidden");
}

function hideError() {
  elements.viewerError.classList.add("hidden");
  elements.viewerError.textContent = "";
}

window.addEventListener("DOMContentLoaded", init);
