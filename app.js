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
    map: L.tileLayer(esri("World_Street_Map"), { maxZoom: 19, attribution: "&copy; Esri" }),
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
  const markers = {};
  let selectedId = null;

  const markerIcon = (place, active) =>
    L.divIcon({
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      html: `<div class="marker${active ? " active" : ""}" style="background:${categoryById[place.category].color}">${categoryById[place.category].svg}</div>`,
    });

  places.forEach((place) => {
    markers[place.id] = L.marker([place.lat, place.lng], { icon: markerIcon(place, false), riseOnHover: true })
      .bindTooltip(place.name, { direction: "top", offset: [0, -16] })
      .on("click", () => openPlace(place.id))
      .addTo(map);
  });

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
    if (selectedId && selectedId !== id) setActive(selectedId, false);
    selectedId = id;
    setActive(id, true);
    history.replaceState(null, "", `#${id}`);

    const info = (place.info ?? [])
      .map((row) => `<div><dt style="color:${c.color}">${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`)
      .join("");

    openSheet({
      html: `
        <div class="cover" style="background:linear-gradient(135deg, ${c.color}, ${c.color}99)">
          ${c.svg}
          <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
        </div>
        <span class="tag" style="background:${c.color}">${escapeHtml(place.tag ?? c.name)}</span>
        <h2 class="place-name">${escapeHtml(place.name)}</h2>
        <p class="address">📍 ${escapeHtml(place.address)}, ${escapeHtml(communeName)}</p>
        ${place.description ? `<p class="desc" style="border-color:${c.color};background:${c.color}0D">${escapeHtml(place.description)}</p>` : ""}
        ${info ? `<dl class="info" style="background:${c.color}0A">${info}</dl>` : ""}
        <div class="actions${place.phone ? " three" : ""}">
          <a class="action directions" target="_blank" rel="noopener"
             href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=driving">
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
      expanded = expanded === catId ? null : catId;
      renderCategories();
      return;
    }

    const placeId = e.target.closest("[data-place]")?.dataset.place;
    if (placeId) openPlace(placeId, { fly: true });
  });

  // ---------- Danh mục ----------
  let expanded = null;

  const renderCategories = () => {
    $("sheet-body").innerHTML = categories
      .map((c) => {
        const items = places.filter((p) => p.category === c.id);
        const open = expanded === c.id;
        const list = open && !items.length
          ? `<p class="cat-empty">Chưa có dữ liệu, đang cập nhật.</p>`
          : open
          ? `<ul class="cat-places">${items
              .map(
                (p) => `<li><button type="button" data-place="${p.id}">
                  <span class="dot" style="background:${c.color}"></span>
                  <span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.address)}</small></span>
                  <span class="go">›</span>
                </button></li>`,
              )
              .join("")}</ul>`
          : "";
        return `<div class="cat${open ? " open" : ""}">
          <button type="button" class="cat-row" data-cat="${c.id}" aria-expanded="${open}">
            <span class="cat-icon" style="background:${c.color}">${c.svg}</span>
            <span class="cat-name">${escapeHtml(c.name)}</span>
            <span class="cat-count">${items.length}</span>
            <span class="chevron">⌄</span>
          </button>${list}</div>`;
      })
      .join("");
  };

  $("open-categories").addEventListener("click", () => {
    openSheet({ heading: "Danh mục địa điểm", html: "" });
    renderCategories();
  });

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
