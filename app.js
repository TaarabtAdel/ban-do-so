(() => {
  const { categories, boundary, places, communeName, title, subtitle } = window.MAP_DATA;
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const $ = (id) => document.getElementById(id);

  const normalize = (s) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  document.title = title;
  $("title").textContent = title;
  $("subtitle").textContent = subtitle;

  // ---------- Bản đồ ----------
  const esri = (path) => `https://server.arcgisonline.com/ArcGIS/rest/services/${path}/MapServer/tile/{z}/{y}/{x}`;
  const LAYERS = {
    map: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }),
    satellite: L.layerGroup([
      L.tileLayer(esri("World_Imagery"), { maxZoom: 19, attribution: "&copy; Esri" }),
      L.tileLayer(esri("Reference/World_Boundaries_and_Places"), { maxZoom: 19 }),
    ]),
  };
  let layer = "map";

  const map = L.map("map", { zoomControl: false });
  LAYERS.map.addTo(map);
  map.attributionControl.addAttribution("Ranh giới &copy; OpenStreetMap");
  L.control.scale({ position: "bottomleft", imperial: false }).addTo(map);

  const boundaryLayer = L.polygon(boundary, {
    color: "#1E3A6E",
    weight: 3,
    fillColor: "#64748B",
    fillOpacity: 0.12,
  }).addTo(map);
  boundaryLayer.bindTooltip(communeName, { permanent: true, direction: "center", className: "commune-label" });

  const fitBoundary = () => map.fitBounds(boundaryLayer.getBounds(), { padding: [24, 24] });
  fitBoundary();

  // ---------- Marker ----------
  // OCOP + quán ăn/cafe: không ghim mặc định (quá đông); vẫn xem trong danh mục/tìm kiếm; chỉ hiện marker khi lọc đúng nhóm.
  const MAP_HIDDEN_CATEGORIES = new Set(["ocop", "quan-an", "cafe"]);

  const markerOnMap = (place, filterId) =>
    MAP_HIDDEN_CATEGORIES.has(place.category) ? filterId === place.category : !filterId || place.category === filterId;

  const markers = {};
  let selectedId = null;

  const markerIcon = (place, active) =>
    L.divIcon({
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<div class="marker${active ? " active" : ""}" style="background:${categoryById[place.category].color}">${categoryById[place.category].svg}</div>
        <span class="marker-label">${escapeHtml(place.name)}</span>`,
    });

  // Các điểm trùng toạ độ (nhiều sản phẩm OCOP của cùng một cơ sở) được xếp toả tròn quanh vị trí cơ sở.
  const groups = {};
  places.forEach((p) => (groups[`${p.lat},${p.lng}`] ??= []).push(p));
  const markerPos = {};
  Object.values(groups).forEach((group) =>
    group.forEach((p, i) => {
      if (group.length === 1) return void (markerPos[p.id] = [p.lat, p.lng]);
      const angle = (2 * Math.PI * i) / group.length;
      const r = 0.0004;
      markerPos[p.id] = [p.lat + r * Math.sin(angle), p.lng + (r * Math.cos(angle)) / Math.cos((p.lat * Math.PI) / 180)];
    }),
  );

  places.forEach((place) => {
    markers[place.id] = L.marker(markerPos[place.id], { icon: markerIcon(place, false), riseOnHover: true })
      .bindTooltip(place.name, { direction: "top", offset: [0, -16], className: "place-tip" })
      .on("click", () => openPlace(place.id));
    if (markerOnMap(place, null)) markers[place.id].addTo(map);
  });

  const LABELS_KEY = "ban-do-so:hien-ten";
  const setLabels = (on) => {
    $("toggle-labels").checked = on;
    $("map").classList.toggle("labels-on", on);
    localStorage.setItem(LABELS_KEY, on ? "1" : "0");
  };
  setLabels(localStorage.getItem(LABELS_KEY) !== "0");
  $("toggle-labels").addEventListener("change", (e) => setLabels(e.target.checked));

  const setActive = (id, active) => {
    const place = places.find((p) => p.id === id);
    if (place) markers[id].setIcon(markerIcon(place, active)).setZIndexOffset(active ? 1000 : 0);
  };

  // ---------- Bảng trượt ----------
  let onSheetClose = null;

  const openSheet = ({ heading, html, onClose }) => {
    const previous = onSheetClose;
    onSheetClose = null;
    previous?.();
    $("sheet-head").hidden = !heading;
    $("sheet-title").textContent = heading ?? "";
    $("sheet-body").innerHTML = html;
    $("sheet-body").scrollTop = 0;
    $("sheet").hidden = false;
    onSheetClose = onClose ?? null;
  };

  const closeSheet = () => {
    if ($("sheet").hidden) return;
    $("sheet").hidden = true;
    const cb = onSheetClose;
    onSheetClose = null;
    cb?.();
  };

  $("sheet").addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeSheet();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeSheet());

  // ---------- Chi tiết địa điểm ----------
  const ICON_DIRECTIONS =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></svg>';
  const ICON_SHARE =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 13.3 7.6 4.4M15.8 6.3l-7.6 4.4"/></svg>';

  const ICON_PHONE =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>';

  function openPlace(id, { fly = false } = {}) {
    const place = places.find((p) => p.id === id);
    if (!place) return;
    const c = categoryById[place.category];
    if (filterCategory && filterCategory !== place.category) setFilter(null);
    if (selectedId && selectedId !== id) setActive(selectedId, false);
    selectedId = id;
    setActive(id, true);
    history.replaceState(null, "", `#${id}`);

    const info = (place.info ?? [])
      .map((row) => `<div><dt style="color:${c.color}">${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`)
      .join("");

    openSheet({
      html: `
        <div class="cover${place.photo ? " photo" : ""}" style="background:linear-gradient(135deg, ${c.color}, ${c.color}99)">
          ${
            place.photo
              ? `<a href="${escapeHtml(place.photo)}" target="_blank" rel="noopener"><img src="${escapeHtml(place.photo)}" alt="${escapeHtml(place.name)}" /></a>`
              : c.svg
          }
          <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
        </div>
        <span class="tag" style="background:${c.color}">${escapeHtml(place.tag ?? c.name)}</span>
        <h2 class="place-name">${escapeHtml(place.name)}</h2>
        <p class="address">📍 ${escapeHtml(place.address)}, ${escapeHtml(communeName)}</p>
        ${place.description ? `<p class="desc" style="border-color:${c.color};background:${c.color}0D">${escapeHtml(place.description)}</p>` : ""}
        ${info ? `<dl class="info" style="background:${c.color}0A">${info}</dl>` : ""}
        <div class="actions${place.phone ? " three" : ""}">
          <a class="action directions" target="_blank" rel="noopener"
             href="https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}">
            <span>${ICON_DIRECTIONS}</span>Chỉ đường
          </a>
          <button type="button" class="action share" data-share="${place.id}"><span>${ICON_SHARE}</span>Chia sẻ</button>
          ${place.phone ? `<a class="action call" href="tel:${place.phone}"><span>${ICON_PHONE}</span>Gọi điện</a>` : ""}
        </div>`,
      onClose: () => {
        if (selectedId !== id) return;
        setActive(id, false);
        selectedId = null;
        history.replaceState(null, "", location.pathname + location.search);
      },
    });

    if (fly) flyToVisible(place);
  }

  // Bay tới điểm sao cho không bị thẻ chi tiết che (dưới trên điện thoại, bên trái trên máy tính).
  const flyToVisible = (place) => {
    const zoom = Math.max(map.getZoom(), 17);
    const panel = document.querySelector(".sheet-panel");
    const desktop = window.matchMedia("(min-width: 900px)").matches;
    const shift = desktop ? [-(panel.offsetWidth + 16) / 2, 0] : [0, panel.offsetHeight / 2];
    const center = map.unproject(map.project([place.lat, place.lng], zoom).add(shift), zoom);
    map.flyTo(center, zoom, { duration: 0.8 });
  };

  $("sheet-body").addEventListener("click", async (e) => {
    const id = e.target.closest("[data-share]")?.dataset.share;
    if (id) {
      const place = places.find((p) => p.id === id);
      const url = `${location.origin}${location.pathname}#${id}`;
      try {
        if (navigator.share) await navigator.share({ title: place.name, text: `${place.name} - ${communeName}`, url });
        else {
          await navigator.clipboard.writeText(url);
          toast("Đã sao chép liên kết");
        }
      } catch {
        // Người dùng huỷ chia sẻ.
      }
      return;
    }

    const catId = e.target.closest("[data-cat]")?.dataset.cat;
    if (catId) {
      renderCategoryPlaces(catId);
      return;
    }
    if (e.target.closest("[data-cat-back]")) {
      renderCategoryGrid();
      return;
    }
    const showCat = e.target.closest("[data-show-cat]")?.dataset.showCat;
    if (showCat) {
      closeSheet();
      setFilter(showCat);
      return;
    }
    if (e.target.closest("[data-more]")) {
      menu.limit += PAGE_SIZE;
      renderCategoryList();
      return;
    }

    const placeId = e.target.closest("[data-place]")?.dataset.place;
    if (placeId) openPlace(placeId, { fly: true });
  });

  $("sheet-body").addEventListener("input", (e) => {
    if (e.target.id !== "cat-search") return;
    menu.query = e.target.value;
    menu.limit = PAGE_SIZE;
    renderCategoryList();
  });

  // ---------- Danh mục (2 bước: lưới danh mục → danh sách điểm) ----------
  // Chịu được xã/phường có hàng trăm điểm: không xổ dài, có tìm kiếm, sắp theo khoảng cách, hiện dần theo trang.
  const PAGE_SIZE = 30;
  const menu = { categoryId: null, query: "", limit: PAGE_SIZE };
  let myPosition = null;

  const distanceM = ([lat1, lng1], [lat2, lng2]) => {
    const rad = (d) => (d * Math.PI) / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
  };
  const formatDistance = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`);

  const countOf = (id) => places.filter((p) => p.category === id).length;

  const renderCategoryGrid = () => {
    menu.categoryId = null;
    $("sheet-head").hidden = false;
    $("sheet-title").textContent = "Danh mục địa điểm";
    $("sheet-body").innerHTML = `<div class="cat-grid">${categories
      .map((c) => {
        const count = countOf(c.id);
        return `<button type="button" class="cat-tile${count ? "" : " is-empty"}" data-cat="${c.id}">
          <span class="cat-icon" style="background:${c.color}">${c.svg}</span>
          <b>${escapeHtml(c.name)}</b>
          <small>${count ? `${count} ${c.unit ?? "điểm"}` : "Đang cập nhật"}</small>
        </button>`;
      })
      .join("")}</div>`;
    $("sheet-body").scrollTop = 0;
  };

  const renderCategoryPlaces = (id) => {
    const c = categoryById[id];
    const count = countOf(id);
    Object.assign(menu, { categoryId: id, query: "", limit: PAGE_SIZE });
    $("sheet-head").hidden = true;
    $("sheet-body").innerHTML = `
      <div class="cat-head">
        <button type="button" class="icon-btn" data-cat-back aria-label="Quay lại danh mục">‹</button>
        <span class="cat-icon small" style="background:${c.color}">${c.svg}</span>
        <h2>${escapeHtml(c.name)}</h2>
        <span class="cat-count">${count}</span>
      </div>
      ${
        count
          ? `<button type="button" class="show-all" data-show-cat="${id}" style="background:${c.color}">Hiện tất cả ${count} ${c.unit ?? "điểm"} trên bản đồ</button>
             ${count > 8 ? `<input id="cat-search" class="cat-search" type="search" placeholder="Tìm trong ${escapeHtml(c.name.charAt(0).toLowerCase() + c.name.slice(1))}" autocomplete="off" />` : ""}
             <ul class="cat-places" id="cat-list"></ul>`
          : `<p class="cat-empty">Chưa có dữ liệu, đang cập nhật.</p>`
      }`;
    $("sheet-body").scrollTop = 0;
    if (count) renderCategoryList();
  };

  /** Chỉ vẽ lại danh sách (không vẽ lại ô tìm kiếm để không mất con trỏ khi đang gõ). */
  const renderCategoryList = () => {
    const c = categoryById[menu.categoryId];
    const q = normalize(menu.query.trim());
    const rows = places
      .filter((p) => p.category === c.id && (!q || normalize(`${p.name} ${p.address}`).includes(q)))
      .map((p) => ({ p, d: myPosition ? distanceM(myPosition, [p.lat, p.lng]) : null }))
      .sort((a, b) => (myPosition ? a.d - b.d : a.p.name.localeCompare(b.p.name, "vi")));
    const shown = rows.slice(0, menu.limit);
    $("cat-list").innerHTML =
      (rows.length === 0 ? `<li class="cat-empty">Không tìm thấy địa điểm phù hợp</li>` : "") +
      shown
        .map(
          ({ p, d }) => `<li><button type="button" data-place="${p.id}">
            <span class="dot" style="background:${c.color}"></span>
            <span><b>${escapeHtml(p.name)}</b><small>${p.stars ? `${"★".repeat(p.stars)} · ${escapeHtml(p.producer)}` : escapeHtml(p.address)}</small></span>
            ${d != null ? `<em>${formatDistance(d)}</em>` : ""}
            <span class="go">›</span>
          </button></li>`,
        )
        .join("") +
      (rows.length > menu.limit ? `<li><button type="button" class="more" data-more>Xem thêm ${Math.min(PAGE_SIZE, rows.length - menu.limit)} điểm</button></li>` : "");
  };

  $("open-categories").addEventListener("click", () => {
    openSheet({ heading: "Danh mục địa điểm", html: "" });
    renderCategoryGrid();
  });

  // ---------- Lọc điểm theo danh mục trên bản đồ ----------
  let filterCategory = null;

  function setFilter(id) {
    filterCategory = id;
    places.forEach((p) => {
      const show = markerOnMap(p, id);
      if (show && !map.hasLayer(markers[p.id])) markers[p.id].addTo(map);
      if (!show && map.hasLayer(markers[p.id])) markers[p.id].remove();
    });
    const chip = $("filter-chip");
    chip.hidden = !id;
    document.querySelector(".demo-note").hidden = !!id;
    if (!id) return;
    const c = categoryById[id];
    chip.style.background = c.color;
    chip.innerHTML = `Đang lọc: ${escapeHtml(c.name)} (${countOf(id)}) <span aria-hidden="true">✕</span>`;
    const points = places.filter((p) => p.category === id).map((p) => [p.lat, p.lng]);
    if (points.length) map.flyToBounds(points, { padding: [64, 64], maxZoom: 17, duration: 0.6 });
  }

  $("filter-chip").addEventListener("click", () => setFilter(null));

  // ---------- Thống kê ----------
  $("open-stats").addEventListener("click", () => {
    const max = Math.max(...categories.map((c) => places.filter((p) => p.category === c.id).length), 1);
    openSheet({
      heading: "Thống kê địa điểm",
      html:
        `<p class="stat-total">Tổng cộng <b style="color:var(--text)">${places.length}</b> địa điểm trên địa bàn ${escapeHtml(communeName)}</p>` +
        categories
          .map((c) => {
            const count = places.filter((p) => p.category === c.id).length;
            return `<div class="stat-row"><div><span>${escapeHtml(c.name)}</span><b>${count}</b></div>
              <div class="bar"><span style="width:${(count / max) * 100}%;background:${c.color}"></span></div></div>`;
          })
          .join(""),
    });
  });

  // ---------- Tìm kiếm ----------
  const renderResults = () => {
    const q = normalize($("search").value.trim());
    $("search-clear").hidden = !q;
    if (!q) {
      $("results").hidden = true;
      return;
    }
    const found = places.filter((p) => normalize(`${p.name} ${p.address} ${categoryById[p.category].name}`).includes(q)).slice(0, 8);
    $("results").hidden = false;
    $("results").innerHTML = found.length
      ? found
          .map((p) => {
            const c = categoryById[p.category];
            return `<li><button type="button" data-id="${p.id}"><span class="dot" style="background:${c.color}"></span>
              <span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(c.name)} • ${escapeHtml(p.address)}</small></span></button></li>`;
          })
          .join("")
      : `<li class="empty">Không tìm thấy địa điểm</li>`;
  };

  $("search").addEventListener("input", renderResults);
  $("search-clear").addEventListener("click", () => {
    $("search").value = "";
    renderResults();
  });
  $("results").addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    $("search").value = "";
    renderResults();
    $("search").blur();
    openPlace(id, { fly: true });
  });

  // ---------- Điều khiển ----------
  $("zoom-in").addEventListener("click", () => map.zoomIn());
  $("zoom-out").addEventListener("click", () => map.zoomOut());
  $("fit-boundary").addEventListener("click", fitBoundary);

  $("toggle-layer").addEventListener("click", () => {
    map.removeLayer(LAYERS[layer]);
    layer = layer === "map" ? "satellite" : "map";
    LAYERS[layer].addTo(map);
    $("toggle-layer").classList.toggle("active", layer === "satellite");
  });

  let myMarker;
  $("locate").addEventListener("click", () => {
    if (!navigator.geolocation) {
      toast("Trình duyệt không hỗ trợ định vị");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = [coords.latitude, coords.longitude];
        myPosition = pos;
        if (myMarker) myMarker.setLatLng(pos);
        else
          myMarker = L.marker(pos, {
            icon: L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: '<div class="my-location"></div>' }),
            zIndexOffset: 2000,
          }).addTo(map);
        map.flyTo(pos, 16);
      },
      () => toast("Bạn cần cho phép truy cập vị trí để dùng tính năng này"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });

  // ---------- Thông báo ----------
  let toastTimer;
  function toast(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 2500);
  }

  // ---------- Khởi động ----------
  const initial = location.hash.slice(1);
  if (initial) openPlace(initial, { fly: true });
})();
