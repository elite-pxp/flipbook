(() => {
  "use strict";

  const SUPABASE_URL = "YOUR_SUPABASE_URL";
  const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
  const BUCKET = "flipbook";
  const MAX_PAGES = 200;
  const IMAGE_QUALITY = 0.78;
  const SHARE_URL = "https://elite-pxp.github.io/flipbook/";
  const IS_ADMIN = location.pathname.endsWith("admin.html");
  const PREVIEW_SEED_PAGES = [
    {
      id: "seed-cover",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495062/images/cover_fubtei.png",
      page_number: 1,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-1",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495073/images/1_zzspps.png",
      page_number: 2,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-2",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495322/images/2_amfptu.png",
      page_number: 3,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-3",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495081/images/3_xvqcdj.png",
      page_number: 4,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-4",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495085/images/4_vp5rvs.png",
      page_number: 5,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-5",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495089/images/5_ooygdh.png",
      page_number: 6,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-6",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495093/images/6_nafbrv.png",
      page_number: 7,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-7",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495098/images/7_v13t4i.png",
      page_number: 8,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-8",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495101/images/8_ly3s6d.png",
      page_number: 9,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-9",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495107/images/9_wjdr86.png",
      page_number: 10,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-10",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495110/images/10_i71svh.png",
      page_number: 11,
      created_at: new Date().toISOString()
    },
    {
      id: "seed-page-11",
      image_url: "https://res.cloudinary.com/dozcy2jve/image/upload/v1777495117/images/11_oulrco.png",
      page_number: 12,
      created_at: new Date().toISOString()
    }
  ];
  const FLIP_SOUND_URL = "https://res.cloudinary.com/dozcy2jve/video/upload/v1777488525/images/188485__rofd__flip-page_rz2es2.wav";

  const hasSupabaseConfig =
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_URL !== "YOUR_SUPABASE_URL" &&
    SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";

  let client = null;
  if (window.supabase && hasSupabaseConfig) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  let pagesCache = [];
  let pageFlip = null;
  let flipAudioPool = [];
  let flipAudioIndex = 0;
  let lastFlipSoundAt = 0;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function fetchPages() {
    if (!client) {
      return IS_ADMIN ? [] : PREVIEW_SEED_PAGES;
    }

    const { data, error } = await client
      .from("pages")
      .select("id,image_url,page_number,created_at")
      .order("page_number", { ascending: true });

    if (error) {
      console.error("Failed to fetch pages:", error.message);
      return [];
    }

    if (!data || !data.length) {
      return [];
    }

    return data;
  }

  function updatePageIndicator(currentIndex, total) {
    const indicator = document.getElementById("page-indicator");
    if (!indicator) return;
    const interiorTotal = Math.max(0, total - 1);
    if (currentIndex <= 0) {
      indicator.textContent = interiorTotal > 0 ? `Cover / ${interiorTotal}` : "Cover / 0";
      return;
    }
    indicator.textContent = `Page ${currentIndex} / ${interiorTotal}`;
  }

  function bindViewerButtons(total) {
    const home = document.getElementById("home-page");
    const prev = document.getElementById("prev-page");
    const next = document.getElementById("next-page");
    const edgePrev = document.getElementById("edge-prev");
    const edgeNext = document.getElementById("edge-next");
    const gotoInput = document.getElementById("goto-page");
    const gotoSelect = document.getElementById("goto-select");
    const gotoBtn = document.getElementById("goto-btn");
    const downloadBtn = document.getElementById("download-pdf");
    const shareBtn = document.getElementById("share-page");
    const isMobile = window.matchMedia("(max-width: 768px)").matches;

    if (isMobile) {
      [prev, next, gotoInput, gotoBtn, downloadBtn, shareBtn].forEach((el) => {
        if (el) el.style.display = "none";
      });
      if (gotoSelect) gotoSelect.style.display = "inline-block";
    } else if (gotoSelect) {
      gotoSelect.style.display = "none";
    }

    if (home) {
      home.onclick = () => {
        if (!pageFlip) return;
        pageFlip.flip(0);
      };
    }

    if (prev) prev.onclick = () => pageFlip && pageFlip.flipPrev();
    if (next) next.onclick = () => pageFlip && pageFlip.flipNext();
    if (edgePrev) edgePrev.onclick = () => pageFlip && pageFlip.flipPrev();
    if (edgeNext) edgeNext.onclick = () => pageFlip && pageFlip.flipNext();

    const go = () => {
      if (!pageFlip || !gotoInput) return;
      const page = Number(gotoInput.value);
      const interiorTotal = Math.max(0, total - 1);
      if (!Number.isFinite(page) || page < 1 || page > interiorTotal) return;
      pageFlip.flip(page + 1);
    };

    if (gotoSelect) {
      const interiorTotal = Math.max(0, total - 1);
      gotoSelect.innerHTML = `<option value="">Go to</option>${Array.from({ length: interiorTotal }, (_, i) => `<option value="${i + 1}">Page ${i + 1}</option>`).join("")}`;
      gotoSelect.onchange = () => {
        if (!pageFlip) return;
        const page = Number(gotoSelect.value);
        if (!Number.isFinite(page) || page < 1 || page > interiorTotal) return;
        pageFlip.flip(page + 1);
      };
    }

    if (gotoBtn) gotoBtn.onclick = go;
    if (gotoInput) {
      gotoInput.onkeydown = (e) => {
        if (e.key === "Enter") go();
      };
    }

    if (downloadBtn && !isMobile) {
      downloadBtn.onclick = async () => {
        if (!pagesCache.length) return;
        downloadBtn.disabled = true;
        const prevLabel = downloadBtn.textContent;
        downloadBtn.textContent = "Preparing PDF...";
        try {
          await downloadPdf(pagesCache);
        } catch (err) {
          alert(`PDF export failed: ${err.message}`);
        } finally {
          downloadBtn.disabled = false;
          downloadBtn.textContent = prevLabel || "Download PDF";
        }
      };
    }

    if (shareBtn && !isMobile) {
      shareBtn.onclick = async () => {
        const url = SHARE_URL;
        const originalText = shareBtn.textContent || "Copy Link";
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            shareBtn.textContent = "Copied";
            setTimeout(() => {
              shareBtn.textContent = originalText;
            }, 1400);
          } else {
            prompt("Copy this link:", url);
          }
        } catch (_) {
          shareBtn.textContent = "Copy failed";
          setTimeout(() => {
            shareBtn.textContent = originalText;
          }, 1400);
        }
      };
    }
  }

  function prepareToolbarForDevice(isMobile, total) {
    const prev = document.getElementById("prev-page");
    const next = document.getElementById("next-page");
    const gotoInput = document.getElementById("goto-page");
    const gotoBtn = document.getElementById("goto-btn");
    const downloadBtn = document.getElementById("download-pdf");
    const shareBtn = document.getElementById("share-page");
    const gotoSelect = document.getElementById("goto-select");
    const pageStatus = document.querySelector(".page-status");

    if (isMobile) {
      [prev, next, gotoInput, gotoBtn, downloadBtn, shareBtn].forEach((el) => {
        if (el) el.style.display = "none";
      });
      if (gotoSelect) {
        const interiorTotal = Math.max(0, total - 1);
        gotoSelect.innerHTML = `<option value="">Go to</option>${Array.from({ length: interiorTotal }, (_, i) => `<option value="${i + 1}">Page ${i + 1}</option>`).join("")}`;
        gotoSelect.style.display = "inline-block";
      }
      if (pageStatus) pageStatus.style.display = "none";
    } else {
      if (gotoSelect) gotoSelect.style.display = "none";
      if (pageStatus) pageStatus.style.display = "";
    }
  }

  async function loadImageElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
      img.src = src;
    });
  }

  function imageToJpegDataUrl(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.92);
  }

  async function downloadPdf(pages) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("PDF library is not available.");
    }

    const { jsPDF } = window.jspdf;
    const first = await loadImageElement(pages[0].image_url);
    const firstOrientation = first.naturalWidth >= first.naturalHeight ? "landscape" : "portrait";
    const doc = new jsPDF({
      orientation: firstOrientation,
      unit: "pt",
      format: [first.naturalWidth, first.naturalHeight],
      compress: true
    });

    for (let i = 0; i < pages.length; i += 1) {
      const img = i === 0 ? first : await loadImageElement(pages[i].image_url);
      const dataUrl = imageToJpegDataUrl(img);
      const pageW = img.naturalWidth;
      const pageH = img.naturalHeight;
      const orientation = pageW >= pageH ? "landscape" : "portrait";

      if (i > 0) {
        doc.addPage([pageW, pageH], orientation);
      }

      doc.addImage(dataUrl, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
    }

    doc.save("flipbook.pdf");
  }

  function buildPageHtml(pages) {
    return pages
      .map((item, idx) => {
        const loading = idx < 4 ? "eager" : "lazy";
        return `
          <div class="page" data-density="hard">
            <img src="${escapeHtml(item.image_url)}" alt="" loading="${loading}" decoding="async" />
          </div>
        `;
      })
      .join("");
  }

  function loadImageSize(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to read image dimensions."));
      img.src = src;
    });
  }

  async function getFlipDimensions(pages) {
    const fallback = { width: 900, height: 600 };
    if (!pages.length) return fallback;

    try {
      const size = await loadImageSize(pages[0].image_url);
      if (!size.width || !size.height) return fallback;
      return { width: size.width, height: size.height };
    } catch (_) {
      return fallback;
    }
  }

  async function renderFlipbook() {
    const container = document.getElementById("flipbook");
    const shell = document.querySelector(".book-shell");
    if (!container) return;

    pagesCache = await fetchPages();

    if (!pagesCache.length) {
      container.innerHTML = '<div class="page"><p style="padding:24px">No pages available.</p></div>';
      updatePageIndicator(0, 0);
      return;
    }

    container.innerHTML = buildPageHtml(pagesCache);

    if (!window.St || !window.St.PageFlip) {
      throw new Error("StPageFlip library failed to load.");
    }

    if (pageFlip) {
      pageFlip.destroy();
    }

    const dimensions = await getFlipDimensions(pagesCache);
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    prepareToolbarForDevice(isMobile, pagesCache.length);
    const pageAspect = dimensions.height / dimensions.width;
    const toolbar = document.querySelector(".viewer-toolbar");
    const toolbarHeight = toolbar ? toolbar.getBoundingClientRect().height : 0;
    const footer = document.querySelector(".brand-title");
    const footerHeight = footer ? footer.getBoundingClientRect().height : 0;
    const availableWidth = Math.max(520, Math.min(1100, window.innerWidth - 360));
    const availableHeight = Math.max(320, Math.min(780, window.innerHeight - toolbarHeight - 140));
    const desktopPageWidthByWidth = availableWidth / 2;
    const desktopPageWidthByHeight = availableHeight / pageAspect;
    const desktopPageWidth = Math.max(320, Math.floor(Math.min(desktopPageWidthByWidth, desktopPageWidthByHeight)));
    const desktopPageHeight = Math.floor(desktopPageWidth * pageAspect);
    const mobilePageWidth = Math.max(220, Math.floor(window.innerWidth - 16));
    const mobilePageHeightByAspect = Math.floor(mobilePageWidth * pageAspect);
    const mobileMaxHeight = Math.floor(window.innerHeight - toolbarHeight - 12);
    const mobilePageHeight = Math.max(240, Math.min(mobilePageHeightByAspect, mobileMaxHeight));
    const mobileWidthFromHeight = Math.floor(mobilePageHeight / pageAspect);
    const mobileFinalWidth = Math.min(mobilePageWidth, mobileWidthFromHeight);

    pageFlip = new St.PageFlip(container, {
      width: isMobile ? mobileFinalWidth : desktopPageWidth,
      height: isMobile ? mobilePageHeight : desktopPageHeight,
      size: isMobile ? "stretch" : "fixed",
      minWidth: isMobile ? 180 : 280,
      maxWidth: isMobile ? mobileFinalWidth : desktopPageWidth,
      minHeight: isMobile ? 260 : 320,
      maxHeight: isMobile ? mobilePageHeight : desktopPageHeight,
      maxShadowOpacity: 0.6,
      showCover: true,
      mobileScrollSupport: true,
      flippingTime: 900,
      usePortrait: true,
      autoSize: isMobile
    });

    pageFlip.loadFromHTML(container.querySelectorAll(".page"));

    if (!flipAudioPool.length) {
      flipAudioPool = Array.from({ length: 3 }, () => {
        const audio = new Audio(FLIP_SOUND_URL);
        audio.preload = "auto";
        audio.volume = 0.38;
        audio.load();
        return audio;
      });
    }

    const total = pagesCache.length;
    updatePageIndicator(0, total);
    bindViewerButtons(total);

    function applyCoverShiftByIndex(index) {
      if (!pageFlip) return;
      const bounds = pageFlip.getBoundsRect();
      const lastIndex = Math.max(0, pageFlip.getPageCount() - 1);
      const isFrontCover = index === 0;
      const isBackCover = index === lastIndex;
      const isEdgeCover = isFrontCover || isBackCover;
      const isPortrait = pageFlip.getOrientation() === "portrait";

      if (isEdgeCover && !isPortrait) {
        const shift = Math.round(bounds.pageWidth / 2);
        const signedShift = isFrontCover ? -shift : shift;
        container.style.setProperty("--cover-shift", `${signedShift}px`);
        container.classList.remove("cover-intro");
      } else {
        container.style.setProperty("--cover-shift", "0px");
        container.classList.remove("cover-intro");
      }
    }

    function updateCoverCentering() {
      if (!pageFlip) return;
      applyCoverShiftByIndex(pageFlip.getCurrentPageIndex());
    }

    pageFlip.on("flip", (e) => {
      updatePageIndicator(e.data, total);
    });

    pageFlip.on("changeState", () => {
      if (!shell) return;
      const state = pageFlip.getState();
      shell.classList.toggle("is-flipping", state !== "read");
      if (state === "flipping" || state === "user_fold" || state === "fold_corner") {
        const now = performance.now();
        if (now - lastFlipSoundAt > 150 && flipAudioPool.length) {
          const audio = flipAudioPool[flipAudioIndex % flipAudioPool.length];
          flipAudioIndex += 1;
          lastFlipSoundAt = now;
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      }
      if (state === "read") {
        updateCoverCentering();
      }
    });

    pageFlip.on("changeOrientation", () => {
      updateCoverCentering();
    });

    window.addEventListener("keydown", (e) => {
      if (!pageFlip) return;
      if (e.key === "ArrowLeft") pageFlip.flipPrev();
      if (e.key === "ArrowRight") pageFlip.flipNext();
    });

    setTimeout(updateCoverCentering, 0);
  }

  async function compressImage(file) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed.");
    }

    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");

    const maxDimension = 2200;
    const ratio = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", IMAGE_QUALITY);
    });

    if (!blob) throw new Error("Image compression failed.");

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  }

  async function uploadSingleImage(file) {
    if (!client) throw new Error("Supabase is not configured.");
    const safeName = `${crypto.randomUUID()}.jpg`;
    const path = `${safeName}`;

    const compressed = await compressImage(file);

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(path, compressed, {
        cacheControl: "31536000",
        upsert: false,
        contentType: "image/jpeg"
      });

    if (uploadError) throw uploadError;

    const { data } = client.storage.from(BUCKET).getPublicUrl(path);
    if (!data || !data.publicUrl) {
      throw new Error("Could not get public URL.");
    }

    return { publicUrl: data.publicUrl, path };
  }

  async function uploadImages(files) {
    if (!client) throw new Error("Supabase is not configured.");
    if (!files.length) return;

    pagesCache = await fetchPages();
    if (pagesCache.length + files.length > MAX_PAGES) {
      alert(`Max ${MAX_PAGES} pages allowed.`);
      return;
    }

    let nextNum = pagesCache.length + 1;
    const rows = [];

    for (const file of files) {
      const { publicUrl } = await uploadSingleImage(file);
      rows.push({ image_url: publicUrl, page_number: nextNum++ });
    }

    const { error } = await client.from("pages").insert(rows);
    if (error) throw error;

    await loadAdminGrid();
  }

  async function reorderPages(idsInOrder) {
    if (!client) throw new Error("Supabase is not configured.");
    const updates = idsInOrder.map((id, i) => ({ id, page_number: i + 1 }));
    for (const row of updates) {
      const { error } = await client
        .from("pages")
        .update({ page_number: row.page_number })
        .eq("id", row.id);
      if (error) throw error;
    }
  }

  function extractStoragePath(publicUrl) {
    const marker = `/object/public/${BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length).split("?")[0];
  }

  async function deletePage(id, imageUrl) {
    if (!client) throw new Error("Supabase is not configured.");
    const path = extractStoragePath(imageUrl);

    const { error: dbError } = await client.from("pages").delete().eq("id", id);
    if (dbError) throw dbError;

    if (path) {
      await client.storage.from(BUCKET).remove([path]);
    }

    const remaining = await fetchPages();
    await reorderPages(remaining.map((p) => p.id));
    await loadAdminGrid();
  }

  async function replacePage(id, file, oldUrl) {
    if (!client) throw new Error("Supabase is not configured.");
    const oldPath = extractStoragePath(oldUrl);
    const { publicUrl } = await uploadSingleImage(file);

    const { error } = await client
      .from("pages")
      .update({ image_url: publicUrl })
      .eq("id", id);

    if (error) throw error;

    if (oldPath) {
      await client.storage.from(BUCKET).remove([oldPath]);
    }

    await loadAdminGrid();
  }

  function setDragEvents(card, container) {
    card.addEventListener("dragstart", () => {
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", async () => {
      card.classList.remove("dragging");
      const ids = [...container.querySelectorAll(".card")].map((c) => c.dataset.id);
      try {
        await reorderPages(ids);
        await loadAdminGrid();
      } catch (e) {
        alert(`Reorder failed: ${e.message}`);
      }
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = container.querySelector(".dragging");
      if (!dragging || dragging === card) return;
      const rect = card.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      if (after) {
        card.after(dragging);
      } else {
        card.before(dragging);
      }
    });
  }

  async function loadAdminGrid() {
    const grid = document.getElementById("admin-grid");
    if (!grid) return;

    pagesCache = await fetchPages();
    grid.innerHTML = "";

    for (const page of pagesCache) {
      const card = document.createElement("article");
      card.className = "card";
      card.dataset.id = page.id;
      card.draggable = true;
      card.innerHTML = `
        <div class="drag-handle">Drag to reorder</div>
        <img src="${escapeHtml(page.image_url)}" alt="Page ${page.page_number}" loading="lazy" />
        <div class="card-footer">
          <div class="page-num">Page #${page.page_number}</div>
          <label class="btn" for="replace-${page.id}">Replace</label>
          <input id="replace-${page.id}" type="file" accept="image/*" hidden />
          <button class="btn danger" data-delete="${page.id}">Delete</button>
        </div>
      `;

      setDragEvents(card, grid);

      const replaceInput = card.querySelector(`#replace-${CSS.escape(page.id)}`);
      replaceInput?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          await replacePage(page.id, file, page.image_url);
        } catch (err) {
          alert(`Replace failed: ${err.message}`);
        }
      });

      card.querySelector("[data-delete]")?.addEventListener("click", async () => {
        const ok = confirm(`Delete page #${page.page_number}?`);
        if (!ok) return;
        try {
          await deletePage(page.id, page.image_url);
        } catch (err) {
          alert(`Delete failed: ${err.message}`);
        }
      });

      grid.appendChild(card);
    }
  }

  function initDropzone() {
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("file-input");

    if (!dropzone || !fileInput) return;

    async function handleFiles(list) {
      const files = [...list].filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      try {
        await uploadImages(files);
      } catch (error) {
        alert(`Upload failed: ${error.message}`);
      }
      fileInput.value = "";
    }

    fileInput.addEventListener("change", async (e) => {
      if (e.target.files) await handleFiles(e.target.files);
    });

    ["dragenter", "dragover"].forEach((name) => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((name) => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });

    dropzone.addEventListener("drop", async (e) => {
      const files = e.dataTransfer?.files;
      if (files?.length) await handleFiles(files);
    });
  }

  async function ensureAuth() {
    if (!client) {
      alert("Supabase is not configured. Set URL and anon key in app.js for admin features.");
      return;
    }

    const authSection = document.getElementById("auth-section");
    const adminSection = document.getElementById("admin-section");
    const form = document.getElementById("login-form");
    const message = document.getElementById("auth-message");
    const logoutBtn = document.getElementById("logout-btn");

    if (!authSection || !adminSection || !form || !message || !logoutBtn) return;

    async function refreshAuthUi() {
      const { data } = await client.auth.getSession();
      const loggedIn = !!data.session;
      authSection.classList.toggle("hidden", loggedIn);
      adminSection.classList.toggle("hidden", !loggedIn);

      if (loggedIn) {
        await loadAdminGrid();
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      message.textContent = "";

      const email = document.getElementById("email")?.value.trim();
      const password = document.getElementById("password")?.value;

      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        message.textContent = error.message;
        return;
      }

      await refreshAuthUi();
    });

    logoutBtn.addEventListener("click", async () => {
      await client.auth.signOut();
      await refreshAuthUi();
    });

    client.auth.onAuthStateChange(() => {
      refreshAuthUi();
    });

    await refreshAuthUi();
    initDropzone();
  }

  if (IS_ADMIN) {
    ensureAuth().catch((e) => {
      console.error(e);
      alert(`Admin initialization failed: ${e.message}`);
    });
  } else {
    renderFlipbook().catch((e) => {
      console.error(e);
    });
  }
})();
