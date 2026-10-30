(() => {
  const { commune, categories } = window.MAP_DATA;
  const $ = (id) => document.getElementById(id);

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  const svg = (paths, size = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

  // Đầu trang
  $("commune-name").textContent = commune.name;
  $("province").textContent = commune.province;
  document.title = `Bản đồ tiện ích ${commune.name} – ${commune.province}`;
  $("facts").innerHTML = [
    ["Diện tích", commune.area],
    ["Dân số", commune.population],
    ["Mật độ", commune.density],
    ["Sáp nhập từ", commune.mergedFrom.map((n) => `xã ${n}`).join(", ")],
    ["Trụ sở", commune.office],
  ]
    .map(([label, value]) => `<li>${label}<b>${escapeHtml(value)}</b></li>`)
    .join("");

  // Ô tiện ích
  const shortName = commune.name.replace(/^xã\s+/i, "Xã ");
  $("tiles").innerHTML = categories
    .map(
      (c) => `<button type="button" class="tile" data-id="${c.id}">
        <span class="tile-icon" style="background:${c.bg};color:${c.color}">${svg(c.icon)}</span>
        <span class="tile-text"><b>${escapeHtml(c.label)}</b><span>${escapeHtml(shortName)}</span></span>
      </button>`,
    )
    .join("");

  // Bản đồ
  const target = (category, point) => (point ? `${point.lat},${point.lng}` : category.query);
  const embedUrl = (category, point) =>
    `https://maps.google.com/maps?q=${encodeURIComponent(target(category, point))}&z=${point ? 17 : 14}&hl=vi&output=embed`;
  const gmapsUrl = (category, point) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target(category, point))}`;
  const directionsUrl = (category, point) =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target(category, point))}`;

  let current = null;

  const showPoint = (category, point) => {
    $("map-frame").src = embedUrl(category, point);
    $("btn-gmaps").href = gmapsUrl(category, point);
    $("btn-directions").href = directionsUrl(category, point);
    document.querySelectorAll("#info-points button").forEach((b) => b.classList.toggle("active", point && b.dataset.index === String(category.points.indexOf(point))));
  };

  const select = (id, { scroll = false } = {}) => {
    const category = categories.find((c) => c.id === id) ?? categories[0];
    current = category;
    document.querySelectorAll(".tile").forEach((t) => t.classList.toggle("active", t.dataset.id === category.id));

    $("info-group").textContent = category.group;
    $("info-group").style.cssText = `background:${category.bg};color:${category.color}`;
    $("info-title").textContent = category.title;
    $("info-desc").textContent = category.description;
    $("info-points").innerHTML = category.points
      .map(
        (p, i) => `<li><button type="button" data-index="${i}">${escapeHtml(p.name)}${p.address ? `<small>${escapeHtml(p.address)}</small>` : ""}</button></li>`,
      )
      .join("");
    document.querySelector(".note").hidden = category.points.length > 0;

    showPoint(category, category.points[0]);
    history.replaceState(null, "", `#${category.id}`);
    if (scroll && window.matchMedia("(max-width: 860px)").matches) {
      document.querySelector(".viewer").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  $("tiles").addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (tile) select(tile.dataset.id, { scroll: true });
  });

  $("info-points").addEventListener("click", (e) => {
    const button = e.target.closest("button[data-index]");
    if (button && current) showPoint(current, current.points[Number(button.dataset.index)]);
  });

  select(location.hash.slice(1));
})();
