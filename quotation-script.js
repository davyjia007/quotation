let F = {
    productCategory: "产品分类",
    productName: "产品名称",
    model: "产品型号",
    materialCategory: "物料分类",
    size: "尺寸",
    system: "系统",
    bandwidth: "带宽",
    materialName: "物料名称",
    sap: "SAP",
    desc: "物料描述",
    remark: "备注",
    ratio: "Ratio",
    englishDesc: "Description",
    price: "Price",
    power: "Power",
    pixelW: "Pixel Width",
    pixelH: "Pixel Height",
    pixelH2: "Pixel Height 2",
    panelDimension: "Panel Dimension",
    waterproof: "Waterproof",
    pixelPitch: "Pixel Pitch",
    refreshRate: "Refresh Rate"
};

const categories = [
    { id: "CecoCeco", label: "ArtMorph", image: "images/category-artmorph.jpg", note: "Creative and architectural display" },
    { id: "Fixed Install", label: "Fix Install", image: "images/category-fix-install.jpg", note: "Permanent installation display" },
    { id: "Rental-Indoor", label: "Rental-Indoor", image: "images/category-rental-indoor.jpg", source: "Rental", waterproof: "Indoor", note: "Indoor touring and staging display" },
    { id: "Rental-Outdoor", label: "Rental-Outdoor", image: "images/category-rental-outdoor.jpg", source: "Rental", waterproof: "Outdoor", note: "Outdoor touring and staging display" }
];

const pages = [
    { id: "product", label: "Product" },
    { id: "power", label: "Power" },
    { id: "processing", label: "Network" },
    { id: "summary", label: "Quote" }
];
const validSystems = ["Brompton", "MVR", "Nova", "Colorlight", "Other System"];
const sectionOrder = ["LED Screen", "Processor", "Cables", "Spare Parts for Free", "Spare Parts for Charged"];

const state = {
    rows: [],
    page: "product",
    category: "Fixed Install",
    model: "",
    sizeMode: "grid",
    unit: "m",
    aspect: "16:9",
    halfRowEnabled: false,
    extras: { Full: 0, Half: 0, Vertical: 0, Quarter: 0 },
    panelQtyTouched: new Set(),
    qtyOverrides: new Map(),
    priceOverrides: new Map(),
    productImages: {},
    showSap: true,
    showPrice: true,
    showTopology: true,
    discount: 0,
    mappingReport: null,
    iframeReady: false
};

const $ = id => document.getElementById(id);
const money = value => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number = (value, fallback = 0) => {
    const raw = String(value ?? "").replace(/,/g, "").trim();
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;
    const loose = parseFloat(raw.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(loose) ? loose : fallback;
};
const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const compact = value => String(value ?? "").replace(/\s+/g, " ").trim();

function deriveFields(rows) {
    const keys = Object.keys(rows.find(row => row && Object.keys(row).length) || {});
    const byName = name => keys.find(key => key.trim() === name) || name;
    const byIndex = (index, fallback) => keys[index] || fallback;
    F = {
        productCategory: byName("产品分类") || byIndex(0, "产品分类"),
        productName: byName("产品名称") || byIndex(1, "产品名称"),
        model: byName("产品型号") || byIndex(2, "产品型号"),
        materialCategory: byName("物料分类") || byIndex(3, "物料分类"),
        size: byName("尺寸") || byIndex(4, "尺寸"),
        system: byName("系统") || byIndex(5, "系统"),
        bandwidth: byName("带宽") || byIndex(6, "带宽"),
        materialName: byName("物料名称") || byIndex(7, "物料名称"),
        sap: byName("SAP"),
        desc: byName("物料描述") || byIndex(9, "物料描述"),
        remark: byName("备注") || byIndex(10, "备注"),
        ratio: byName("Ratio"),
        power: byName("Power"),
        pixelW: byName("Pixel Width"),
        pixelH: byName("Pixel Height"),
        englishDesc: byName("Description"),
        price: byName("Price"),
        panelDimension: byName("Panel Dimension"),
        waterproof: byName("Waterproof"),
        pixelH2: byName("Pixel Height 2"),
        pixelPitch: byName("Pixel Pitch"),
        refreshRate: byName("Refresh Rate")
    };
}

function materialCategory(row) { return compact(row?.[F.materialCategory]); }
function isPanel(row) { return materialCategory(row) === "Panel" || (!!row?.[F.panelDimension] && !!row?.[F.pixelPitch] && !!row?.[F.model]); }
function isProcessor(row) { return materialCategory(row) === "Processor"; }
function isFreeSpare(row) { return materialCategory(row) === "Spare_free"; }
function isChargedSpare(row) { return materialCategory(row) === "Spare_charged"; }
function normalizeSize(size) {
    const raw = compact(size);
    if (/quarter/i.test(raw)) return "Quarter";
    if (/vertical/i.test(raw)) return "Vertical";
    if (/half/i.test(raw)) return "Half";
    if (/edge/i.test(raw)) return "Edge";
    return raw || "Full";
}
function cleanEnglish(value) {
    return compact(value).replace(/[\u3400-\u9fff]+/g, " ").replace(/_/g, " ").replace(/\s+/g, " ").trim();
}
function englishName(row, fallback) {
    const name = `${row?.[F.materialName] || ""} ${row?.[F.englishDesc] || ""}`.toLowerCase();
    if (name.includes("psu") || name.includes("开关电源") || name.includes("power supply")) return "Power Supply Unit";
    if (name.includes("power box") || name.includes("电源盒")) return "Power Box Assembly";
    if (name.includes("hub") || name.includes("转接板")) return "HUB Board";
    if (name.includes("receiving") || name.includes("接收卡")) return "Receiving Card";
    if (name.includes("module") || name.includes("ims") || name.includes("模组")) return "LED Module";
    if (name.includes("fiber")) return "Fiber Distribution Box";
    if (name.includes("processor") || name.includes("主控")) return `${row?.[F.productName] || ""} Processor`.trim();
    return cleanEnglish(row?.[F.materialName]) || fallback || "Item";
}
function englishDescription(row, fallback) {
    return cleanEnglish(row?.[F.englishDesc]) || cleanEnglish(row?.[F.desc]) || fallback || "";
}
function isCoreFreeSpare(row) {
    const name = `${row?.[F.materialName] || ""} ${row?.[F.englishDesc] || ""}`.toLowerCase();
    if (name.includes("screw") || name.includes("螺丝") || name.includes("螺钉")) return false;
    return name.includes("模组") || name.includes("ims") || name.includes("module") ||
        name.includes("hub") || name.includes("转接板") || name.includes("receiving card") ||
        name.includes("接收卡") || name.includes("power box") || name.includes("电源盒") ||
        name.includes("psu") || name.includes("开关电源") || name.includes("power supply");
}

function categoryInfo() { return categories.find(item => item.id === state.category) || categories[0]; }
function sourceCategory(cat = categoryInfo()) { return cat.source || cat.id; }
let powerRuleCategory = "";
// Wiring direction and breaker-current rules per product category.
function applyPowerCategoryRules() {
    const select = $("powerRouteSelect");
    const currentSelect = $("currentSelect");
    if (!select || !currentSelect) return;
    const cat = categoryInfo();
    const source = sourceCategory(cat);
    const categoryKey = cat.id;
    const categoryChanged = categoryKey !== powerRuleCategory;
    let locked = false, defaultValue = "vertical";
    let allowedCurrents = [10], defaultCurrent = 10, currentLocked = true;
    if (source === "Rental") {
        defaultValue = "vertical"; locked = true;
        allowedCurrents = [16]; defaultCurrent = 16; currentLocked = true;
    } else if (source === "Fixed Install" || cat.id === "Fixed Install") {
        defaultValue = "horizontal"; locked = false;
        allowedCurrents = [10, 16]; defaultCurrent = 10; currentLocked = false;
    } else if (cat.id === "CecoCeco") {
        defaultValue = "vertical"; locked = false;
    }
    if (categoryChanged || locked || !["vertical", "horizontal"].includes(select.value)) {
        select.value = defaultValue;
    }
    select.disabled = locked;
    const directionLabel = select.closest(".field")?.querySelector("label");
    if (directionLabel) directionLabel.textContent = locked ? "Wiring Direction (Locked)" : "Wiring Direction";

    const existingCurrents = [...currentSelect.options].map(option => Number(option.value));
    if (existingCurrents.join("|") !== allowedCurrents.join("|")) {
        currentSelect.innerHTML = allowedCurrents.map(value => `<option value="${value}">${value} A</option>`).join("");
    }
    if (categoryChanged || !allowedCurrents.includes(Number(currentSelect.value))) {
        currentSelect.value = String(defaultCurrent);
    }
    currentSelect.disabled = currentLocked;
    const currentLabel = currentSelect.closest(".field")?.querySelector("label");
    if (currentLabel) currentLabel.textContent = currentLocked ? "Current (Locked)" : "Current";
    powerRuleCategory = categoryKey;
}
function categoryImage() { return categoryInfo().image; }
function safeModelFile(model) { return String(model || "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "product"; }
function productImage(model = state.model) {
    return state.productImages?.[model]?.file || categoryImage();
}
function imageFallback() { return categoryImage(); }
function rowMatchesCategory(row, cat = categoryInfo()) {
    if (compact(row?.[F.productCategory]) !== sourceCategory(cat)) return false;
    if (cat.waterproof && isPanel(row)) return compact(row?.[F.waterproof]).toLowerCase().includes(cat.waterproof.toLowerCase());
    return true;
}
function productRows() {
    return state.rows.filter(row => rowMatchesCategory(row) && compact(row[F.model]) === state.model);
}
function selectedRows() {
    const sys = $("systemSelect")?.value || "Nova";
    return productRows().filter(row => {
        const rowSystem = compact(row[F.system]);
        return !validSystems.includes(rowSystem) || rowSystem === sys;
    });
}

function pitchNumber(value) {
    const match = compact(value).match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
}
function panelRowsForCategory() {
    return state.rows.filter(row => rowMatchesCategory(row) && isPanel(row));
}
function modelsForCategory() {
    return [...new Set(panelRowsForCategory().map(row => compact(row[F.model])).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
function allProductMatches(query) {
    const q = compact(query).toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const seen = new Set();
    return state.rows.filter(isPanel).map(row => {
        const model = compact(row[F.model]);
        if (!model || seen.has(model)) return null;
        seen.add(model);
        const category = compact(row[F.productCategory]);
        const product = compact(row[F.productName]);
        const haystack = `${model} ${product} ${category}`.toLowerCase();
        if (!tokens.every(token => haystack.includes(token))) return null;
        const modelLower = model.toLowerCase();
        const score = modelLower === q ? 0 : modelLower.startsWith(q) ? 1 : modelLower.includes(q) ? 2 : 3;
        return { model, category, product, row, score };
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.model.localeCompare(b.model, undefined, { numeric: true })).slice(0, 12);
}
function categoryForRow(row) {
    return categories.find(cat => rowMatchesCategory(row, cat)) || categories.find(cat => sourceCategory(cat) === compact(row?.[F.productCategory])) || categories[0];
}
function selectProductMatch(match) {
    if (!match) return;
    state.category = categoryForRow(match.row).id;
    state.model = match.model;
    state.panelQtyTouched.clear();
    $("productSearchInput").value = match.model;
    $("productSuggestions").classList.remove("active");
    populateSystems();
    populateBandwidth();
    applyDefaultProcessingCanvas();
    syncAreaFromGrid();
    renderAll();
}
function ensureModelSelection() {
    const models = modelsForCategory();
    if (!models.includes(state.model)) state.model = models[0] || "";
}
function availableSizes() {
    const sizes = new Set(productRows().filter(isPanel).map(row => normalizeSize(row[F.size])).filter(Boolean));
    if (!sizes.size) sizes.add("Full");
    return sizes;
}

function parsePanelDimension(row) {
    const explicitDimension = compact(row?.[F.panelDimension]);
    const fallbackText = `${row?.[F.englishDesc] || ""} ${row?.[F.desc] || ""}`;
    const text = explicitDimension || fallbackText;
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:mm)?\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*(?:mm)?\s*[xX*]\s*(\d+(?:\.\d+)?))?/);
    if (!match) return null;
    return { w: Number(match[1]), h: Number(match[2]), d: Number(match[3] || 0) };
}
function dimensionLabel(dim) {
    if (!dim) return "Dimension TBD";
    const metric = `${dim.w} x ${dim.h}${dim.d ? ` x ${dim.d}` : ""} mm`;
    const imperial = `${(dim.w / 25.4).toFixed(1)} x ${(dim.h / 25.4).toFixed(1)}${dim.d ? ` x ${(dim.d / 25.4).toFixed(1)}` : ""} in`;
    return `${metric} / ${imperial}`;
}
function getScreenSpecForPanel(row) {
    return {
        row,
        pixelW: number(row?.[F.pixelW], 0),
        pixelH: number(row?.[F.pixelH2], number(row?.[F.pixelH], 0)),
        power: number(row?.[F.power], 0),
        dimension: parsePanelDimension(row)
    };
}
function getScreenSpec(size = "Full") {
    const rows = selectedRows();
    const row = rows.find(item => isPanel(item) && normalizeSize(item[F.size]) === size && (item[F.pixelW] || item[F.pixelH])) ||
        rows.find(item => isPanel(item) && (item[F.pixelW] || item[F.pixelH])) ||
        rows.find(isPanel) ||
        panelRowsForCategory().find(item => compact(item[F.model]) === state.model) ||
        {};
    return getScreenSpecForPanel(row);
}
function cabinetSize(size = "Full") {
    const hasExplicitHalf = selectedRows().some(item => isPanel(item) && normalizeSize(item[F.size]) === "Half");
    if (size === "Half" && !hasExplicitHalf) {
        const fullSpec = getScreenSpec("Full");
        const fullDim = fullSpec.dimension;
        if (fullDim) return { w: fullDim.w, h: fullDim.h / 2, d: fullDim.d };
        const pitch = pitchNumber(fullSpec.row?.[F.pixelPitch]) || pitchNumber(state.model);
        if (pitch && fullSpec.pixelW && fullSpec.pixelH) return { w: fullSpec.pixelW * pitch, h: fullSpec.pixelH * pitch / 2, d: 0 };
        return { w: 500, h: 250, d: 0 };
    }
    const spec = getScreenSpec(size);
    if (spec.dimension) return spec.dimension;
    const pitch = pitchNumber(spec.row?.[F.pixelPitch]) || pitchNumber(state.model);
    if (pitch && spec.pixelW && spec.pixelH) return { w: spec.pixelW * pitch, h: spec.pixelH * pitch, d: 0 };
    return { w: 500, h: 500, d: 0 };
}

function metersToActiveUnit(valueM) { return state.unit === "ft" ? valueM / 0.3048 : valueM; }
function activeUnitToMeters(value) { return state.unit === "ft" ? value * 0.3048 : value; }
function activeUnitLabel() { return state.unit === "ft" ? "feet" : "m"; }
function displayConfig() {
    const cols = Math.max(1, Math.floor(number($("colsInput").value, 1)));
    const rows = Math.max(1, Math.floor(number($("rowsInput").value, 1)));
    const fullPerSet = cols * rows;
    const halfSupported = availableSizes().has("Half");
    if (!halfSupported) state.halfRowEnabled = false;
    const halfRow = halfSupported && state.halfRowEnabled;
    return { cols, rows, sets: 1, halfSupported, halfRow, fullPerSet, halfPerSet: halfRow ? cols : 0 };
}
function physicalSize() {
    const cfg = displayConfig();
    const cab = cabinetSize();
    const displayRows = cfg.rows + (cfg.halfRow ? 0.5 : 0);
    return { widthM: cfg.cols * cab.w / 1000, heightM: displayRows * cab.h / 1000, displayRows };
}
function resolution() {
    const cfg = displayConfig();
    const spec = getScreenSpec();
    const displayRows = cfg.rows + (cfg.halfRow ? 0.5 : 0);
    return { w: spec.pixelW ? cfg.cols * spec.pixelW : 0, h: spec.pixelH ? Math.floor(displayRows * spec.pixelH) : 0 };
}
function setAreaInputs(widthM, heightM) {
    $("widthM").value = metersToActiveUnit(widthM).toFixed(2);
    $("heightM").value = metersToActiveUnit(heightM).toFixed(2);
}
function syncAreaFromGrid() {
    const size = physicalSize();
    setAreaInputs(size.widthM, size.heightM);
}
function aspectValue() {
    if (state.aspect === "16:9") return 16 / 9;
    if (state.aspect === "21:9") return 21 / 9;
    if (state.aspect === "32:9") return 32 / 9;
    return null;
}
function matchGridToAspect(sourceId = "colsInput") {
    const ratio = aspectValue();
    if (!ratio) return;
    const spec = getScreenSpec();
    const pixelW = Math.max(1, spec.pixelW || 1);
    const pixelH = Math.max(1, spec.pixelH || 1);
    if (sourceId === "rowsInput" || sourceId === "heightM") {
        const rows = Math.max(1, Math.round(number($("rowsInput").value, 1)));
        $("colsInput").value = Math.max(1, Math.round(rows * pixelH * ratio / pixelW));
    } else {
        const cols = Math.max(1, Math.round(number($("colsInput").value, 1)));
        $("rowsInput").value = Math.max(1, Math.round(cols * pixelW / ratio / pixelH));
    }
}
function syncGridFromArea(sourceId = "widthM") {
    const cab = cabinetSize();
    const wM = activeUnitToMeters(Math.max(.1, number($("widthM").value, 1)));
    const hM = activeUnitToMeters(Math.max(.1, number($("heightM").value, 1)));
    $("colsInput").value = Math.max(1, Math.round(wM * 1000 / cab.w));
    $("rowsInput").value = Math.max(1, Math.round(hM * 1000 / cab.h));
    matchGridToAspect(sourceId);
    syncAreaFromGrid();
}
function layoutQuantities() {
    const cfg = displayConfig();
    const minimums = { Full: cfg.fullPerSet, Half: cfg.halfPerSet, Vertical: 0, Quarter: 0 };
    const qty = {};
    Object.entries(minimums).forEach(([size, minimum]) => {
        const value = Math.max(minimum, Math.floor(number(state.extras[size], minimum)));
        if (value > 0 || size === "Full") qty[size] = value;
    });
    return qty;
}
function equivalentUnits() {
    const qty = layoutQuantities();
    return Math.ceil((qty.Full || 0) + (qty.Half || 0) * .5 + (qty.Vertical || 0) * .5 + (qty.Quarter || 0) * .25 + (qty.Custom || 0));
}

function portCapacity() {
    const key = `${$("systemSelect").value}|${$("bandwidthSelect").value}|${$("bitRateSelect").value}`;
    return {
        "Nova|1G|10b60Hz": 480000,
        "Nova|5G|10b60Hz": 2291312,
        "Brompton|1G|10b60Hz": 420000,
        "MVR|1G|10b60Hz": 510000,
        "MVR|2.5G|10b60Hz": 1275000,
        "Colorlight|1G|10b60Hz": 487500
    }[key] || 480000;
}
function canvasPixels() {
    if ($("canvasSelect").value === "2K") return 1920 * 1080;
    if ($("canvasSelect").value === "8K") return 7680 * 4320;
    return 3840 * 2160;
}
function getStatNumber(key, fallback = 0) {
    const value = state.mappingReport?.stats?.[key];
    return number(value, fallback);
}
function mappingStats() {
    if (state.mappingReport?.stats && Object.keys(state.mappingReport.stats).length) return state.mappingReport.stats;
    const cfg = displayConfig();
    const spec = getScreenSpec();
    const res = resolution();
    const totalPower = cfg.fullPerSet * (spec.power || 300) + cfg.halfPerSet * (spec.power || 300) * .5;
    const powerCapacity = Math.max(1, number($("voltageSelect").value, 220) * number($("currentSelect").value, 16));
    const mainPower = Math.max(1, Math.ceil(totalPower / powerCapacity));
    const totalPixels = Math.max(1, (res.w || 1) * (res.h || 1));
    const mainData = Math.max(1, Math.ceil(totalPixels / portCapacity()));
    const processors = Math.max(1, Math.ceil(totalPixels / canvasPixels()));
    const transitions = Math.max(0, cfg.rows - 1 + (cfg.halfRow ? 1 : 0));
    return {
        Processors: `${processors} Units`,
        "Main Power": `${mainPower} Feeds`,
        "Power Jumpers": `${Math.max(0, cfg.fullPerSet + cfg.halfPerSet - mainPower)} pcs`,
        "Main Data": `${mainData} Feeds`,
        "Short Data": `${Math.max(0, cfg.fullPerSet + cfg.halfPerSet - mainData)} pcs`,
        "Data Jumpers": `${transitions * cfg.cols} pcs`
    };
}

function defaultPrice(section, title) {
    if (section === "LED Screen") return 880;
    if (section === "Processor") return 4200;
    if (section === "Cables") return title.includes("Main") ? 68 : 18;
    if (section === "Spare Parts for Charged") return 95;
    return 0;
}
function unitPrice(item) {
    if (item.section === "Spare Parts for Free") return 0;
    if (state.priceOverrides.has(item.key)) return state.priceOverrides.get(item.key);
    const fromData = number(item.price, NaN);
    if (Number.isFinite(fromData) && fromData > 0) return fromData;
    return defaultPrice(item.section, item.title);
}
function discountedPrice(item) {
    const raw = unitPrice(item);
    const discount = Math.max(0, Math.min(100, number(state.discount, 0))) / 100;
    return item.section === "Spare Parts for Free" ? 0 : raw * (1 - discount);
}
function addItem(map, item) {
    if (!item.qty || item.qty <= 0) return;
    const existing = map.get(item.key);
    if (existing) existing.qty += item.qty;
    else map.set(item.key, item);
}
function processorRows() {
    const system = $("systemSelect").value;
    const bandwidth = $("bandwidthSelect").value;
    return state.rows.filter(isProcessor).filter(row => row[F.system] === system && (!row[F.bandwidth] || row[F.bandwidth] === bandwidth));
}
function computeItems() {
    const map = new Map();
    Object.entries(layoutQuantities()).forEach(([size, qty]) => {
        const spec = size === "Custom" ? getScreenSpec("Full") : getScreenSpec(size);
        const dim = size === "Custom" ? cabinetSize("Full") : cabinetSize(size);
        const pixelH = size === "Half" && !availableSizes().has("Half") ? Math.floor((spec.pixelH || 0) / 2) : spec.pixelH;
        addItem(map, {
            section: "LED Screen",
            title: `${state.model} ${size} LED Cabinet`,
            desc: [categoryInfo().label, dimensionLabel(dim), spec.pixelW && pixelH ? `${spec.pixelW} x ${pixelH}px per cabinet` : "", `${$("systemSelect").value} control system`].filter(Boolean).join(", "),
            qty,
            unit: "pcs",
            sort: 10,
            key: `screen|${state.category}|${state.model}|${size}|${$("systemSelect").value}|${$("bandwidthSelect").value}`,
            price: spec.row?.[F.price],
            sap: spec.row?.[F.sap] || ""
        });
    });
    const processors = Math.max(1, getStatNumber("Processors", state.mappingReport?.controllerCount || 1));
    const mainProcessor = processorRows()[0];
    addItem(map, {
        section: "Processor",
        title: englishName(mainProcessor, `${$("systemSelect").value} Processor`),
        desc: englishDescription(mainProcessor, `${$("bitRateSelect").selectedOptions[0]?.textContent || ""}, ${$("canvasSelect").value} master canvas`),
        qty: processors,
        unit: "pcs",
        sort: 20,
        key: `processor|${mainProcessor?.[F.sap] || $("systemSelect").value}|${$("canvasSelect").value}`,
        price: mainProcessor?.[F.price],
        sap: mainProcessor?.[F.sap] || ""
    });
    processorRows().filter(row => row !== mainProcessor).slice(0, 1).forEach(row => addItem(map, {
        section: "Processor",
        title: englishName(row, "Fiber Distribution Box"),
        desc: englishDescription(row, "Fiber distribution for processor outputs"),
        qty: processors,
        unit: "pcs",
        sort: 21,
        key: `processor-extra|${row[F.sap]}`,
        price: row[F.price],
        sap: row[F.sap] || ""
    }));
    [
        ["Main Power Cable", "Power feed cable from distribution to display", "Main Power", 30],
        ["Power Jumper Cable", "Cabinet to cabinet power jumper", "Power Jumpers", 31],
        ["Main Data Cable", "Processor output cable to display", "Main Data", 33],
        ["Short Data Cable", "Cabinet to cabinet data cable", "Short Data", 34],
        ["Data Extension Jumper", "Data jumper between rows or separated cabinet groups", "Data Jumpers", 35]
    ].forEach(([title, desc, statKey, sort]) => addItem(map, {
        section: "Cables", title, desc, qty: getStatNumber(statKey, 0), unit: "pcs", sort, key: `cable|${title}`
    }));
    const totalUnits = equivalentUnits();
    selectedRows().forEach(row => {
        const free = isFreeSpare(row);
        const charged = isChargedSpare(row);
        if (!free && !charged) return;
        if (free && !isCoreFreeSpare(row)) return;
        const ratio = number(row[F.ratio], free ? 0.02 : 0.01);
        const qty = Math.max(1, Math.ceil(totalUnits * ratio));
        addItem(map, {
            section: free ? "Spare Parts for Free" : "Spare Parts for Charged",
            title: englishName(row, free ? "Free Spare Part" : "Charged Spare Part"),
            desc: englishDescription(row, cleanEnglish(row[F.desc]) || "Spare part"),
            qty,
            unit: "pcs",
            sort: free ? 50 : 60,
            key: `spare|${row[F.sap] || row[F.materialName]}`,
            price: charged ? row[F.price] : 0,
            sap: row[F.sap] || ""
        });
    });
    return [...map.values()].sort((a, b) => sectionOrder.indexOf(a.section) - sectionOrder.indexOf(b.section) || a.sort - b.sort || a.title.localeCompare(b.title));
}

function setPage(page) {
    state.page = page;
    document.querySelectorAll(".page").forEach(node => node.classList.toggle("active", node.id === `page-${page}`));
    renderSteps();
    renderPageActions();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (page === "summary") cloneWiringPages();
}
function renderSteps() {
    const current = pages.findIndex(page => page.id === state.page);
    $("steps").innerHTML = pages.map((page, index) => `<button class="step ${index === current ? "active" : ""} ${index < current ? "done" : ""}" data-page="${page.id}" data-index="${index + 1}" type="button"><span>${page.label}</span></button>`).join("");
    $("steps").querySelectorAll("[data-page]").forEach(btn => btn.addEventListener("click", () => setPage(btn.dataset.page)));
}
function renderPageActions() {
    const index = pages.findIndex(page => page.id === state.page);
    $("backPageBtn").disabled = index === 0;
    $("nextPageBtn").hidden = index === pages.length - 1;
    $("nextPageBtn").disabled = false;
    $("nextPageBtn").textContent = "Next Step";
    document.querySelector(".top-actions")?.classList.add("is-hidden");
}
function renderCategories() {
    $("categoryRow").innerHTML = categories.map(cat => `
        <button class="category-card ${cat.id === state.category ? "active" : ""}" type="button" data-category="${cat.id}">
            <div class="category-image"><img src="${cat.image}" alt="${cat.label}"></div>
            <strong>${cat.label}</strong>
            <span>${cat.note}</span>
        </button>
    `).join("");
    $("categoryRow").querySelectorAll("[data-category]").forEach(btn => btn.addEventListener("click", () => {
        state.category = btn.dataset.category;
        state.panelQtyTouched.clear();
        ensureModelSelection();
        populateSystems();
        populateBandwidth();
        applyDefaultProcessingCanvas();
        syncGridFromArea();
        renderAll();
    }));
}
function renderModels() {
    ensureModelSelection();
    const models = modelsForCategory();
    $("modelCarousel").innerHTML = models.map(model => {
        const panel = panelRowsForCategory().find(row => compact(row[F.model]) === model);
        const spec = getScreenSpecForPanel(panel);
        return `<button class="model-card ${model === state.model ? "active" : ""}" type="button" data-model="${escapeHtml(model)}">
            <img src="${productImage(model)}" alt="${escapeHtml(model)}" onerror="this.onerror=null;this.src='${imageFallback()}';">
            <strong>${escapeHtml(model)}</strong>
            <span>${escapeHtml(panel?.[F.productName] || categoryInfo().label)}</span>
            <div class="product-tooltip">
                <div><strong>Model:</strong> ${escapeHtml(model)}</div>
                <div><strong>Power:</strong> ${escapeHtml(spec.power ? `${spec.power} W/cabinet` : "TBD")}</div>
                <div><strong>Dimension:</strong> ${escapeHtml(dimensionLabel(spec.dimension))}</div>
                <div><strong>Waterproof:</strong> ${escapeHtml(compact(panel?.[F.waterproof]) || "TBD")}</div>
            </div>
        </button>`;
    }).join("");
    $("modelCarousel").querySelectorAll("[data-model]").forEach(btn => btn.addEventListener("click", () => {
        state.model = btn.dataset.model;
        state.panelQtyTouched.clear();
        populateSystems();
        populateBandwidth();
        applyDefaultProcessingCanvas();
        syncGridFromArea();
        renderAll();
    }));
    $("selectedProductImage").src = productImage();
    $("selectedProductImage").onerror = () => { $("selectedProductImage").onerror = null; $("selectedProductImage").src = imageFallback(); };
    $("screenTexture").src = productImage();
    $("screenTexture").onerror = () => { $("screenTexture").onerror = null; $("screenTexture").src = imageFallback(); };
    $("selectedProductName").textContent = state.model ? `${state.model} / ${categoryInfo().label}` : "-";
    // Auto-scroll carousel to the active model
    requestAnimationFrame(() => {
        const activeCard = document.querySelector("#modelCarousel .model-card.active");
        if (activeCard) activeCard.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
}
function renderProductSuggestions(query) {
    const target = $("productSuggestions");
    const matches = allProductMatches(query);
    target.innerHTML = matches.map((match, index) => `<button type="button" data-search-index="${index}">
        <span><strong>${escapeHtml(match.model)}</strong><small>${escapeHtml(match.product || match.category)}</small></span>
        <small>${escapeHtml(categoryForRow(match.row).label)}</small>
    </button>`).join("");
    target.classList.toggle("active", matches.length > 0);
    target.querySelectorAll("[data-search-index]").forEach(button => button.addEventListener("click", () => selectProductMatch(matches[number(button.dataset.searchIndex, 0)])));
    return matches;
}
function renderCabinetOptions() {
    // Hide unit tabs (m/ft) in Column/Row mode - unit is implicitly pcs
    const unitField = document.querySelector("#unitTabs").closest(".field");
    if (unitField) { unitField.style.display = state.sizeMode === "area" ? "" : "none"; }
    const sizes = availableSizes();
    const hasHalf = sizes.has("Half");
    if (!hasHalf) {
        state.halfRowEnabled = false;
    }
    $("halfRowControl").classList.toggle("active", hasHalf);
    $("halfRowToggle").classList.toggle("active", state.halfRowEnabled && hasHalf);
    $("halfRowToggle").setAttribute("aria-pressed", String(state.halfRowEnabled && hasHalf));
    const cfg = displayConfig();
    const minimums = { Full: cfg.fullPerSet, Half: cfg.halfPerSet, Vertical: 0, Quarter: 0 };
    const list = ["Full", "Half", "Vertical", "Quarter"].filter(size => sizes.has(size) || size === "Full");
    $("cabinetOptions").innerHTML = list.map(size => {
        const minimum = minimums[size] || 0;
        if (!state.panelQtyTouched.has(size) || number(state.extras[size], 0) < minimum) state.extras[size] = minimum;
        return `<div class="cabinet-option">
            <label><span>${size === "Half" ? "Last: Half panel" : size === "Vertical" ? "Vertical panel" : size === "Quarter" ? "Quarter panel" : "Full panel"}</span><small>Mapped ${minimum}</small></label>
            <input type="number" min="${minimum}" step="1" value="${Math.max(minimum, number(state.extras[size], minimum))}" data-cabinet-size="${size}">
        </div>`;
    }).join("");
    $("cabinetOptions").querySelectorAll("[data-cabinet-size]").forEach(input => input.addEventListener("input", event => {
        const minimum = Math.max(0, Math.floor(number(event.target.min, 0)));
        state.panelQtyTouched.add(event.target.dataset.cabinetSize);
        state.extras[event.target.dataset.cabinetSize] = Math.max(minimum, Math.floor(number(event.target.value, minimum)));
        renderAll();
    }));
}
function populateSystems() {
    const systems = new Set();
    productRows().forEach(row => {
        const sys = compact(row[F.system]);
        if (validSystems.includes(sys)) systems.add(sys);
    });
    if (!systems.size) systems.add("Nova");
    const previous = $("systemSelect").value;
    $("systemSelect").innerHTML = [...systems].map(sys => `<option value="${sys}">${sys}</option>`).join("");
    if (systems.has(previous)) $("systemSelect").value = previous;
    else if (systems.has("Nova")) $("systemSelect").value = "Nova";
}
function populateBandwidth() {
    const system = $("systemSelect").value;
    const values = new Set();
    productRows().forEach(row => {
        if (row[F.system] === system && row[F.bandwidth]) values.add(row[F.bandwidth]);
    });
    if (system === "MVR" && values.has("2.5G")) values.add("1G");
    if (system === "Nova" && values.has("5G")) values.add("1G");
    if (!values.size) values.add("1G");
    const previous = $("bandwidthSelect").value;
    $("bandwidthSelect").innerHTML = [...values].map(value => `<option value="${value}">${value}</option>`).join("");
    if (values.has(previous)) $("bandwidthSelect").value = previous;
}
function applyDefaultProcessingCanvas() {
    if ($("canvasSelect")) $("canvasSelect").value = state.model === "AM6" ? "2K" : "4K";
    if ($("bitRateSelect")) $("bitRateSelect").value = "10b60Hz";
}
function renderComparison() {
    const size = physicalSize();
    const res = resolution();
    const cfg = displayConfig();
    const aspect = size.widthM / Math.max(.1, size.heightM);
    const stage = $("screenCompare").parentElement;
    const stageW = stage?.clientWidth || 760;
    const maxW = Math.min(stageW * .68, 980);
    const maxH = 270;
    let screenW = maxW;
    let screenH = screenW / Math.max(.1, aspect);
    if (screenH > maxH) {
        screenH = maxH;
        screenW = screenH * Math.max(.1, aspect);
    }
    screenW = Math.max(90, screenW);
    screenH = Math.max(70, screenH);
    const leftPx = Math.max(86, (stageW - screenW) / 2);
    const bottomPx = 78;
    $("screenCompare").style.left = `${leftPx}px`;
    $("screenCompare").style.bottom = `${bottomPx}px`;
    $("screenCompare").style.width = `${screenW}px`;
    $("screenCompare").style.height = `${screenH}px`;
    const gridRows = cfg.rows + (cfg.halfRow ? 1 : 0);
    const normalCells = Array.from({ length: cfg.cols * cfg.rows }, () => `<div class="screen-cell"></div>`).join("");
    const halfCells = cfg.halfRow ? Array.from({ length: cfg.cols }, () => `<div class="screen-cell half"></div>`).join("") : "";
    $("screenGrid").style.gridTemplateColumns = `repeat(${cfg.cols}, minmax(0, 1fr))`;
    $("screenGrid").style.gridTemplateRows = cfg.halfRow ? `${Array.from({ length: cfg.rows }, () => "1fr").join(" ")} .5fr` : `repeat(${gridRows}, minmax(0, 1fr))`;
    $("screenGrid").innerHTML = normalCells + halfCells;
    $("dimWidth").textContent = `${size.widthM.toFixed(2)} m / ${(size.widthM / 0.3048).toFixed(1)} ft`;
    $("dimHeight").textContent = `${size.heightM.toFixed(2)} m / ${(size.heightM / 0.3048).toFixed(1)} ft`;
    $("dimWidth").style.left = `${leftPx + screenW / 2}px`;
    $("dimWidth").style.bottom = `${bottomPx + screenH + 2}px`;
    $("dimWidth").style.transform = "translateX(-50%)";
    // Height label: center of rotated text at screen right-edge midpoint
    // translate(-50%,-50%) on the rotated element perfectly centers the / at the positioned point
    const stageH = document.querySelector(".comparison-stage")?.clientHeight || 450;
    const screenMidY = stageH - bottomPx - screenH / 2;
    // 11px = 4px visual gap + 7px half line-height (translate -50% on rotated element)
    $("dimHeight").style.left = `${leftPx + screenW + 11}px`;
    $("dimHeight").style.right = "auto";
    $("dimHeight").style.bottom = "auto";
    $("dimHeight").style.top = `${screenMidY}px`;
    $("dimHeight").style.transform = "translate(-50%, -50%) rotate(90deg)";
    $("dimHeight").style.transformOrigin = "";
    // Width label: right below the screen
    $("dimWidth").style.bottom = `${bottomPx + screenH + 1}px`;
    const personH = Math.max(46, Math.min(screenH * 0.96, screenH * 1.8 / Math.max(1.8, size.heightM)));
    const personW = personH * 0.38;
    const human = document.querySelector(".human");
    human.style.height = `${personH}px`;
    human.style.width = `${personW}px`;
    human.style.left = `${Math.max(16, leftPx - personW - 14)}px`;
    human.style.bottom = `${bottomPx}px`;
    $("dimDiagonal").textContent = `Display ${size.widthM.toFixed(2)} m x ${size.heightM.toFixed(2)} m / ${(size.widthM / 0.3048).toFixed(1)} ft x ${(size.heightM / 0.3048).toFixed(1)} ft | ${res.w || "-"} x ${res.h || "-"} px`;
    $("dimDiagonal").style.bottom = `${Math.max(18, bottomPx - 38)}px`;
}
function renderProductInfo() {
    const cfg = displayConfig();
    const size = physicalSize();
    const res = resolution();
    const spec = getScreenSpec();
    const cab = cabinetSize();
    const qty = layoutQuantities();
    const totalModules = Object.values(qty).reduce((sum, value) => sum + number(value, 0), 0);
$("productInfoPanel").innerHTML = [
    [dimensionLabel(cab).split(" / ")[0], "Single panel dimension"],
    [`${cfg.cols} columns x ${size.displayRows} rows`, "Final cabinet layout"],
    [`${size.widthM.toFixed(2)}m x ${size.heightM.toFixed(2)}m`, "Final display size"],
    [res.w && res.h ? `${res.w} x ${res.h}px` : "TBD", "Final resolution"],
    [`${totalModules}`, "Panels"]
    ].map(([value, label]) => `<div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
}
function cableGroups(matrix, mode) {
    const groups = {};
    matrix.forEach((row, r) => row.forEach((cell, c) => {
        const label = mode === "power" ? cell.powerLabel : cell.portLabel;
        const match = String(label || "").match(mode === "power" ? /P(\d+)-(\d+)/ : /D(\d+)-(\d+)/);
        if (!match) return;
        const controllerId = Number(cell.controllerId || 1);
        const key = mode === "power" ? `P${match[1]}` : `C${controllerId}-D${match[1]}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ r, c, seq: Number(match[2]), controllerId, run: Number(match[1]) });
    }));
    Object.values(groups).forEach(items => items.sort((a, b) => a.seq - b.seq));
    return groups;
}
const CONTROLLER_COLOR_PRESETS = [
    { h: 0, s: 74, l: 52 }, { h: 120, s: 58, l: 46 }, { h: 240, s: 68, l: 50 },
    { h: 60, s: 72, l: 52 }, { h: 180, s: 64, l: 48 }, { h: 300, s: 58, l: 56 },
    { h: 30, s: 74, l: 50 }, { h: 270, s: 62, l: 54 }, { h: 160, s: 56, l: 48 },
    { h: 200, s: 66, l: 50 }, { h: 340, s: 60, l: 54 }, { h: 15, s: 70, l: 50 }
];
function getControllerTone(index = 1) {
    const tone = CONTROLLER_COLOR_PRESETS[(Math.max(1, index) - 1) % CONTROLLER_COLOR_PRESETS.length];
    const cycle = Math.floor((Math.max(1, index) - 1) / CONTROLLER_COLOR_PRESETS.length);
    return { h: tone.h, s: Math.max(0, tone.s - cycle * 4), l: Math.min(92, tone.l + cycle * 3) };
}
function controllerFill(id, alpha = .2) {
    const tone = getControllerTone(Math.max(1, Number(id) || 1));
    return `hsla(${tone.h}, ${tone.s}%, ${tone.l}%, ${alpha})`;
}
function controllerStroke(id) {
    const tone = getControllerTone(Math.max(1, Number(id) || 1));
    return `hsl(${tone.h}, ${tone.s}%, ${tone.l}%)`;
}
function controllerLine(id) { return controllerStroke(id); }
function powerMappingTone(labelOrId) {
    const match = String(labelOrId || "").match(/P(\d+)/);
    const index = match ? Math.max(0, Number(match[1]) - 1) : 0;
    const cycle = Math.floor(index / 2) % 3;
    return {
        fill: index % 2 === 0 ? "hsla(4, 78%, 55%, 0.18)" : "transparent",
        border: `hsl(4, 74%, ${[68, 62, 72][cycle]}%)`,
        line: `hsl(4, 82%, ${[47, 42, 52][cycle]}%)`
    };
}
// Matches mapping.html portFillColor() rules: per-controller hue with per-port variant
function topologyFill(matrix, cell) {
    const ids = [...new Set(matrix.flat().map(item => item?.controllerId || 1))].sort((a, b) => a - b);
    // Single controller + topology context → transparent (same as mapping.html)
    if (ids.length <= 1) return "transparent";
    const ctrlId = cell?.controllerId || 1;
    const toneIndex = ids.indexOf(ctrlId) + 1;
    const tone = getControllerTone(toneIndex);
    // Use raw port index (safePort) like mapping.html, not position within sorted-unique list
    const rawPort = Number(String(cell?.portLabel || "").match(/D(\d+)/)?.[1] || 0);
    const variant = rawPort % 4;
    const cycleLift = Math.floor(rawPort / 4) % 2;
    const tones = [
        { l: 50, s: 62, h: -3 },
        { l: 66, s: 58, h: 2 },
        { l: 55, s: 60, h: -2 },
        { l: 70, s: 54, h: 3 },
    ];
    const c = tones[variant] || tones[0];
    const lightness = Math.max(28, Math.min(82, c.l + cycleLift * 2));
    const saturation = Math.max(24, Math.min(82, Math.round(tone.s * 0.58 + c.s * 0.42)));
    if (tone.s === 0) return `hsl(210, ${Math.max(22, c.s - 10)}%, ${lightness}%)`;
    return `hsl(${(tone.h + c.h + 360) % 360}, ${saturation}%, ${lightness}%)`;
}
// Border color always neutral gray like mapping.html's cab-module
function dataBorderColor(surface = "light") {
    return surface === "dark" ? "rgba(157,208,255,0.58)" : "rgba(31,41,55,0.18)";
}
function powerStroke(run = 1) { return powerMappingTone(`P${run}`).line; }
function routedWirePath(p1, p2, direction, laneOffset = 0) {
    const mainInset = 0.28;
    const sideInset = 0.18;
    const mid = (a, b) => (a + b) / 2;
    const isVert = direction === "vertical";
    if (isVert) {
        if (p1.c === p2.c && p1.r !== p2.r) {
            const down = p2.r > p1.r;
            const startY = down ? p1.y + p1.box.height * mainInset : p1.y - p1.box.height * mainInset;
            const endY = down ? p2.y - p2.box.height * mainInset : p2.y + p2.box.height * mainInset;
            return `M ${p1.x} ${startY} L ${p2.x} ${endY}`;
        }
        if (p1.c !== p2.c) {
            const right = p2.c > p1.c;
            const startX = right ? p1.box.right - p1.box.width * sideInset : p1.box.left + p1.box.width * sideInset;
            const endX = right ? p2.box.left + p2.box.width * sideInset : p2.box.right - p2.box.width * sideInset;
            const seamX = right ? mid(p1.box.right, p2.box.left) : mid(p1.box.left, p2.box.right);
            const startY = p1.y + laneOffset;
            const endY = p2.y + laneOffset;
            return p1.r === p2.r
                ? `M ${startX} ${startY} L ${seamX} ${startY} L ${endX} ${startY}`
                : `M ${startX} ${startY} L ${seamX} ${startY} L ${seamX} ${endY} L ${endX} ${endY}`;
        }
    } else {
        if (p1.r === p2.r && p1.c !== p2.c) {
            const right = p2.c > p1.c;
            const startX = right ? p1.x + p1.box.width * mainInset : p1.x - p1.box.width * mainInset;
            const endX = right ? p2.x - p2.box.width * mainInset : p2.x + p2.box.width * mainInset;
            return `M ${startX} ${p1.y + laneOffset} L ${endX} ${p2.y + laneOffset}`;
        }
        if (p1.r !== p2.r) {
            const down = p2.r > p1.r;
            const startY = down ? p1.box.bottom - p1.box.height * sideInset : p1.box.top + p1.box.height * sideInset;
            const endY = down ? p2.box.top + p2.box.height * sideInset : p2.box.bottom - p2.box.height * sideInset;
            const seamY = down ? mid(p1.box.bottom, p2.box.top) : mid(p1.box.top, p2.box.bottom);
            const startX = p1.x + laneOffset;
            const endX = p2.x + laneOffset;
            return p1.c === p2.c
                ? `M ${startX} ${startY} L ${startX} ${seamY} L ${startX} ${endY}`
                : `M ${startX} ${startY} L ${startX} ${seamY} L ${endX} ${seamY} L ${endX} ${endY}`;
        }
    }
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
}
function wirePoint(item, cellW, cellH, gap, mode, direction, lane) {
    const left = item.c * (cellW + gap);
    const top = item.r * (cellH + gap);
    const box = { left, top, right: left + cellW, bottom: top + cellH, width: cellW, height: cellH };
    const cx = left + cellW / 2;
    const cy = top + cellH / 2;
    const sideLane = mode === "power" ? -lane : lane;
    return {
        r: item.r,
        c: item.c,
        x: direction === "vertical" ? cx + sideLane : cx,
        y: direction === "vertical" ? cy : cy + sideLane,
        box
    };
}
function renderWireSvg(matrix, mode, cellW, cellH, gap) {
    const groups = cableGroups(matrix, mode);
    const paths = [];
    const direction = $("powerRouteSelect")?.value || "vertical";
    const lane = Math.min(11, Math.max(4, Math.min(cellW, cellH) * .22));
    Object.entries(groups).forEach(([groupId, points]) => {
        const color = mode === "power" ? powerStroke(points[0]?.run) : "#1e80ff";
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i];
            const p1 = wirePoint(a, cellW, cellH, gap, mode, direction, lane);
            const p2 = wirePoint(b, cellW, cellH, gap, mode, direction, lane);
            const d = routedWirePath(p1, p2, direction, mode === "power" ? -lane : lane);
            paths.push(`<path d="${d}" stroke="${color}" stroke-width="${mode === "power" ? 2 : 1.7}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`);
        }
    });
    const width = (matrix[0]?.length || 1) * cellW + Math.max(0, (matrix[0]?.length || 1) - 1) * gap;
    const height = matrix.length * cellH + Math.max(0, matrix.length - 1) * gap;
    return `<svg class="wire-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${paths.join("")}</svg>`;
}
function renderBoard(targetId, mode) {
    const cfg = displayConfig();
    const stats = mappingStats();
    const matrix = state.mappingReport?.matrix;
    const matrixRows = Array.isArray(matrix) && matrix.length ? matrix : null;
    const rows = matrixRows ? matrixRows.length : cfg.rows + (cfg.halfRow ? 1 : 0);
    const cols = matrixRows ? matrixRows[0]?.length || cfg.cols : cfg.cols;
    const startCount = mode === "power" ? getStatNumber("Main Power", number(stats["Main Power"], 1)) : getStatNumber("Main Data", number(stats["Main Data"], 1));
    const cab = cabinetSize();
    const ratio = Math.max(.25, Math.min(2.8, cab.h / Math.max(1, cab.w)));
    const cellW = Math.max(16, Math.min(42, Math.floor(720 / Math.max(1, cols))));
    const cellH = Math.max(12, Math.min(54, Math.round(cellW * ratio)));
    const gap = cols > 24 ? 3 : 5;
    const displayMatrix = matrixRows || Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => ({ r, c })));
    let html = `<div class="run-label ${mode}">${mode === "power" ? "Power Runs" : "Data Runs"}: ${startCount}</div>`;
    html += `<div class="legend"><span class="${mode === "power" ? "power-dot" : "data-dot"}">${mode === "power" ? "Power route" : "Data route"}</span><span>${cfg.cols} x ${cfg.rows} | panel ${cab.w} x ${cab.h} mm</span></div>`;
    html += `<div class="wiring-map" style="--cell-w:${cellW}px;--cell-h:${cellH}px;">`;
    if (matrixRows) html += renderWireSvg(displayMatrix, mode, cellW, cellH, gap);
    html += `<div class="cabinet-grid" style="grid-template-columns:repeat(${cols}, ${cellW}px);gap:${gap}px;">`;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = matrixRows?.[r]?.[c];
            const label = mode === "power" ? cell?.powerLabel : cell ? (cell.portLabel || "") : "";
            const start = mode === "power" ? /P\d+-1$/.test(cell?.powerLabel || "") : /D\d+-1$/.test(cell?.portLabel || "");
            const fallbackLinear = $("powerRouteSelect").value === "horizontal" ? r * cols + c : c * rows + r;
            const fallbackStart = !cell && fallbackLinear < startCount;
            const klass = start || fallbackStart ? (mode === "power" ? "power-start" : "data-start") : "";
            const colorStyle = cell
                ? mode === "power"
                    ? `background:${powerMappingTone(cell.powerLabel).fill};border-color:${powerMappingTone(cell.powerLabel).border};`
                    : `background:${topologyFill(displayMatrix, cell)};border-color:${dataBorderColor("dark")};`
                : "";
            html += `<div class="cab ${klass}" style="width:${cellW}px;height:${cellH}px;font-size:${Math.max(4, Math.min(6.5, cellW * .17))}px;${colorStyle}">${escapeHtml(label || (fallbackStart ? (mode === "power" ? `P${fallbackLinear + 1}` : `D${fallbackLinear + 1}`) : ""))}</div>`;
        }
    }
    html += "</div></div>";
    $(targetId).innerHTML = html;
}
function summaryCards(cards) {
    return cards.map(card => `<div class="summary-card">${card.map(([key, value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>`).join("");
}
function renderPowerPage() {
    applyPowerCategoryRules();
    const stats = mappingStats();
    const spec = getScreenSpec();
    const cfg = displayConfig();
    const size = physicalSize();
    const totalPower = cfg.fullPerSet * spec.power + cfg.halfPerSet * spec.power * .5;
    $("powerSummary").innerHTML = summaryCards([
        [["Input Voltage", `${$("voltageSelect").value} V`], ["Breaker Rating", `${$("currentSelect").value} A`]],
        [["Unit Power", `${spec.power || "TBD"} W`], ["Estimated Load", `${Math.round(totalPower).toLocaleString()} W`]],
        [["Main Power", stats["Main Power"] || "-"], ["Power Jumpers", stats["Power Jumpers"] || "-"]],
        [["Screen Size", `${size.widthM.toFixed(2)} x ${size.heightM.toFixed(2)} m`], ["Cable Length", `${$("powerCableLength").value} m`]]
    ]);
    $("powerDiagramMeta").textContent = `${$("voltageSelect").value} V / ${$("currentSelect").value} A / ${$("powerRouteSelect").selectedOptions[0]?.textContent || ""}`;
    renderBoard("powerBoard", "power");
}
function renderProcessorCanvases() {
    const pages = state.mappingReport?.processorPages;
    const target = $("processorCanvases");
    if (!Array.isArray(pages) || !pages.length) {
        target.innerHTML = "";
        return;
    }
    const canvas = state.mappingReport?.masterCanvas || { key: $("canvasSelect").value, width: $("canvasSelect").value === "2K" ? 1920 : $("canvasSelect").value === "8K" ? 7680 : 3840, height: $("canvasSelect").value === "2K" ? 1080 : $("canvasSelect").value === "8K" ? 4320 : 2160 };
    target.innerHTML = pages.map(page => {
        const canvasCols = Math.max(1, Math.floor(number(page.canvasCols, 1)));
        const canvasRows = Math.max(1, Math.floor(number(page.canvasRows, 1)));
        const rowRatios = Array.isArray(page.rowRatios) && page.rowRatios.length ? page.rowRatios : Array.from({ length: canvasRows }, () => 1);
        const cellW = Math.max(12, Math.min(28, Math.floor(520 / canvasCols)));
        const rowHeights = Array.from({ length: canvasRows }, (_, index) => Math.max(8, Math.round(cellW * number(rowRatios[index], 1))));
        const byPos = new Map((page.occupied || []).map(item => [`${item.localRow}|${item.localCol}`, item]));
        const items = [];
        for (let r = 0; r < canvasRows; r++) {
            for (let c = 0; c < canvasCols; c++) {
                const cell = byPos.get(`${r}|${c}`);
                const controllerId = cell?.cell?.controllerId || page.displayIndex + 1;
                const style = cell ? `height:${rowHeights[r]}px;background:${controllerFill(controllerId, .32)};border-color:${controllerStroke(controllerId)};` : `height:${rowHeights[r]}px;`;
                items.push(`<div class="processor-mini-cell" style="${style}">${escapeHtml(cell?.cell?.portLabel || "")}</div>`);
            }
        }
        const grid = `<div class="processor-mini-grid" style="grid-template-columns:repeat(${canvasCols}, ${cellW}px);">${items.join("")}</div>`;
        const used = page.actualPixelW && page.actualPixelH ? `${Math.round(page.actualPixelW)} x ${Math.round(page.actualPixelH)} px used` : `${page.portCount || 0} ports`;
        return `<article class="processor-canvas-card">
            <h3>${escapeHtml($("systemSelect").value)} ${escapeHtml(page.title || `Processor ${page.displayIndex + 1}`)} / ${escapeHtml(canvas.key || $("canvasSelect").value)}</h3>
            <div class="processor-canvas-meta">${escapeHtml(canvas.width || "-")} x ${escapeHtml(canvas.height || "-")} px canvas / ${escapeHtml(used)}</div>
            <div class="processor-canvas-frame">${grid}</div>
        </article>`;
    }).join("");
}
function renderProcessingPage() {
    const stats = mappingStats();
    const processorCount = Math.max(1, getStatNumber("Processors", state.mappingReport?.controllerCount || 1));
    $("processingSummary").innerHTML = summaryCards([
        [["Processor Model", $("systemSelect").value], ["Bandwidth", $("bandwidthSelect").value]],
        [["Master Canvas", $("canvasSelect").value], ["Signal", $("bitRateSelect").selectedOptions[0]?.textContent || ""]],
        [["Processors", stats.Processors || `${processorCount} Units`], ["Main Data", stats["Main Data"] || "-"]],
        [["Short Data", stats["Short Data"] || "-"], ["Data Jumpers", stats["Data Jumpers"] || "-"]]
    ]);
    $("networkDiagramMeta").textContent = `${processorCount} processor(s), ${stats["Main Data"] || "data runs pending"}`;
    $("controllerStack").innerHTML = "";
    renderBoard("networkBoard", "data");
    renderProcessorCanvases();
}
function renderQuoteSummary() {
    const cfg = displayConfig();
    const size = physicalSize();
    const res = resolution();
    const area = size.widthM * size.heightM;
    const systemText = `${$("systemSelect").value} / ${$("bandwidthSelect").value}`;
    $("quoteSummary").innerHTML = [
        ["Model:", state.model],
        ["Control System:", systemText],
        ["Display Tiles Quantity:", `W ${cfg.cols} pcs x H ${size.displayRows} pcs`],
        ["Display Area:", `${(area * 10.7639).toFixed(2)} ft² (${area.toFixed(2)} m²)`],
        ["Display Resolution:", res.w && res.h ? `W ${res.w} px x H ${res.h} px` : "TBD"]
    ].map(row => `<div class="quote-summary-row"><div>${row[0]}</div><div><strong>${row[1]}</strong></div></div>`).join("");
}
function renderQuotePageClones() {
    const source = document.querySelector(".paper:not(.quote-page-clone)");
    if (!source) return;
    document.querySelector(".quote-page-stack")?.remove();
    source.classList.remove("quote-source-hidden");
    const paginate = source.scrollHeight > source.clientHeight + 2;
    document.body.classList.toggle("quote-multipage", paginate);
    if (!paginate) return;
    source.classList.add("quote-source-hidden");
    const groups = [];
    let current = null;
    [...source.querySelectorAll("#quoteBody > tr")].forEach(row => {
        if (row.classList.contains("quote-section")) {
            current = { section: row, items: [] };
            groups.push(current);
        } else if (current) current.items.push(row);
    });
    const stack = document.createElement("div");
    stack.className = "quote-page-stack";
    source.insertAdjacentElement("afterend", stack);
    const pages = [];
    const makePage = () => {
        const index = pages.length;
        const page = source.cloneNode(true);
        page.classList.remove("quote-source-hidden");
        page.classList.add("quote-page-clone");
        page.removeAttribute("id");
        page.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
        const body = page.querySelector("tbody");
        body.innerHTML = "";
        if (index > 0) page.querySelector(".quote-summary")?.remove();
        page.querySelector(".total-row")?.remove();
        const title = page.querySelector(".paper-head h2");
        if (title && index > 0) title.textContent = "Quotation - Continued";
        stack.appendChild(page);
        pages.push(page);
        return page;
    };
    const fits = page => page.scrollHeight <= page.clientHeight + 2;
    const addSection = (page, section, continued = false) => {
        const row = section.cloneNode(true);
        if (continued) row.cells[0].textContent += " - Continued";
        page.querySelector("tbody").appendChild(row);
        return row;
    };
    let page = makePage();
    groups.forEach(group => {
        let body = page.querySelector("tbody");
        const beforeCount = body.children.length;
        const appended = [addSection(page, group.section), ...group.items.map(row => {
            const clone = row.cloneNode(true);
            body.appendChild(clone);
            return clone;
        })];
        if (fits(page)) return;
        appended.forEach(node => node.remove());
        if (beforeCount > 0) page = makePage();
        body = page.querySelector("tbody");
        addSection(page, group.section);
        group.items.forEach(item => {
            const clone = item.cloneNode(true);
            body.appendChild(clone);
            if (fits(page)) return;
            clone.remove();
            page = makePage();
            body = page.querySelector("tbody");
            addSection(page, group.section, true);
            body.appendChild(item.cloneNode(true));
        });
    });
    const total = source.querySelector(".total-row")?.cloneNode(true);
    if (total) {
        page.appendChild(total);
        if (!fits(page)) {
            total.remove();
            page = makePage();
            page.appendChild(total);
        }
    }
}
function renderQuote() {
    const items = computeItems();
    const grouped = new Map(sectionOrder.map(section => [section, []]));
    items.forEach(item => grouped.get(item.section)?.push(item));
    const showSap = state.showSap;
    const showPrice = state.showPrice;
    const header = [{ label: "NO.", className: "col-no" }];
    if (showSap) header.push({ label: "SAP", className: "col-sap" });
    header.push({ label: "Product", className: "col-product" });
    header.push({ label: "Quantity", className: "col-qty" });
    if (showPrice) header.push({ label: "Unit Price", className: "col-price" }, { label: "Extended Price", className: "col-extended" });
    $("quoteHead").innerHTML = `<tr>${header.map(item => `<th class="${item.className}">${item.label}</th>`).join("")}</tr>`;
    let no = 1;
    let total = 0;
    const rows = [];
    let renderedSectionCount = 0;
    grouped.forEach((group, section) => {
        if (!group.length) return;
        rows.push(`<tr class="quote-section ${renderedSectionCount === 0 ? "section-first" : ""}"><td colspan="${header.length}">${section}</td></tr>`);
        renderedSectionCount += 1;
        group.forEach(item => {
            const qty = state.qtyOverrides.has(item.key) ? state.qtyOverrides.get(item.key) : item.qty;
            const price = discountedPrice(item);
            const extended = qty * price;
            total += extended;
            const cells = [
                `<td class="col-no">${no++}</td>`
            ];
            if (showSap) cells.push(`<td class="col-sap">${escapeHtml(item.sap || "-")}</td>`);
            cells.push(`<td class="col-product"><span class="item-title">${escapeHtml(item.title)}</span><span class="item-desc">${escapeHtml(item.desc)}</span></td>`);
            cells.push(`<td class="col-qty"><span class="editable-number" data-editable><span class="editable-display" role="button" tabindex="0" title="Click to edit">${Number(qty).toLocaleString("en-US")} ${escapeHtml(item.unit)}</span><span class="editable-editor"><input class="qty-input" data-key="${escapeHtml(item.key)}" type="number" min="0" step="1" value="${qty}"><span class="edit-unit">${escapeHtml(item.unit)}</span></span></span></td>`);
            if (showPrice) {
                const editablePrice = unitPrice(item);
                cells.push(`<td class="col-price">${item.section === "Spare Parts for Free" ? "-" : `<span class="editable-number" data-editable><span class="editable-display" role="button" tabindex="0" title="Click to edit">${money(editablePrice)}</span><span class="editable-editor"><input class="price-input" data-key="${escapeHtml(item.key)}" type="number" min="0" step="1" value="${editablePrice}"></span></span>`}</td>`);
                cells.push(`<td class="col-extended">${item.section === "Spare Parts for Free" ? "-" : money(extended)}</td>`);
            }
            rows.push(`<tr>
                ${cells.join("")}
            </tr>`);
        });
    });
    $("quoteBody").innerHTML = rows.join("");
    $("docTotal").textContent = showPrice ? money(total) : "Hidden";
    $("docModel").textContent = state.model;
    $("docSystem").textContent = `${$("systemSelect").value} / ${$("bandwidthSelect").value}`;
	
    renderQuotePageClones();
	    
    document.querySelectorAll("[data-editable]").forEach(wrapper => {
        const display = wrapper.querySelector(".editable-display");
        const input = wrapper.querySelector("input");
        const beginEdit = () => {
            wrapper.classList.add("editing");
            input.focus();
            input.select();
        };
        display.addEventListener("click", beginEdit);
        display.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                beginEdit();
            }
        });
        input.addEventListener("keydown", event => {
            if (event.key === "Enter") input.blur();
            if (event.key === "Escape") renderQuote();
        });
        input.addEventListener("blur", () => wrapper.classList.remove("editing"));
    });
    document.querySelectorAll(".qty-input").forEach(input => input.addEventListener("change", event => {
        state.qtyOverrides.set(event.target.dataset.key, Math.max(0, number(event.target.value, 0)));
        renderQuote();
    }));
    document.querySelectorAll(".price-input").forEach(input => input.addEventListener("change", event => {
        state.priceOverrides.set(event.target.dataset.key, Math.max(0, number(event.target.value, 0)));
        renderQuote();
    }));
}
function renderAll(syncMap = true) {
    renderSteps();
    renderPageActions();
    renderCategories();
    ensureModelSelection();
    renderModels();
    renderCabinetOptions();
    renderComparison();
    renderProductInfo();
    renderPowerPage();
    renderProcessingPage();
    renderQuoteSummary();
    renderQuote();
    document.body.classList.toggle("show-wiring", state.showTopology);
    if (state.showTopology) cloneWiringPages();
    if (syncMap) syncMapping();
}
function syncMapping() {
    const frame = $("mappingFrame");
    if (!frame.contentWindow || !state.model) return;
    const cfg = displayConfig();
    const spec = getScreenSpec();
    frame.contentWindow.postMessage({
        type: "SYNC_MAPPING",
        model: state.model,
        fullCount: cfg.fullPerSet,
        system: $("systemSelect").value,
        bandwidth: $("bandwidthSelect").value,
        pixelW: spec.pixelW || 128,
        pixelH: spec.pixelH || 128,
        power: spec.power || 300,
        hasHalfSupport: cfg.halfSupported,
        productCategory: sourceCategory(),
        cols: cfg.cols,
        rows: cfg.rows,
        halfRow: cfg.halfRow,
        bitRate: $("bitRateSelect").value,
        voltageSpec: `${$("voltageSelect").value}|${$("currentSelect").value}`,
        routeDirection: $("powerRouteSelect").value,
        masterCanvas: $("canvasSelect").value
    }, "*");
}
function appendixCards(items) {
    return items.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}
function svgPathBetween(a, b) {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (a.c === b.c || a.r === b.r) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
}
function adaptiveSvgLabelSize(text, cellWidth, cellHeight, cols, rows, maxSize = 7) {
    const actual = resolution();
    const density = Math.max(1, number(actual.w, 0) / 1920, number(actual.h, 0) / 1080, cols / 12, rows / 8);
    const byWidth = (cellWidth * .76) / Math.max(1, String(text || "").length * .62);
    const byHeight = cellHeight * .18;
    return Math.max(.6, Math.min(maxSize / Math.sqrt(density), byWidth, byHeight));
}
function appendixMatrixSvg(mode) {
    const matrix = state.mappingReport?.matrix;
    if (!Array.isArray(matrix) || !matrix.length) return "";
    const rows = matrix.length;
    const cols = matrix[0]?.length || 1;
    const unitW = matrix[0]?.[0]?.pixelW || getScreenSpec().pixelW || 1;
    const rowRatios = matrix.map(row => Math.max(.25, Math.max(...row.map(cell => (cell.pixelH || getScreenSpec().pixelH || unitW) / unitW))));
    const ratioTotal = rowRatios.reduce((sum, value) => sum + value, 0);

    // Tight viewBox with minimal margins to maximize grid fill in A4 page
    // Container inside wiring-appendix ≈ 560×680 px
    const pad = 16;
    const titleH = 32;
    const availW = 560;
    const availH = 680;

    // Fit grid: min ensures it fits within container; tight padding maximizes fill
    const cellWFromW = (availW - pad * 2) / cols;
    const cellWFromH = ratioTotal > 0 ? (availH - pad * 2 - titleH) / ratioTotal : cellWFromW;
    const cellW = Math.min(cellWFromW, cellWFromH);
    const rowHeights = rowRatios.map(ratio => ratio * cellW);
    const gridW = cols * cellW;
    const gridH = rowHeights.reduce((sum, value) => sum + value, 0);
    const labelFontSize = Math.max(5.5, Math.min(10, cellW * 0.28));
    const viewW = gridW + pad * 2;
    const viewH = titleH + pad + gridH + pad;
    const startX = pad;
    const startY = titleH + pad;

    const rowY = [startY];
    rowHeights.forEach(height => rowY.push(rowY[rowY.length - 1] + height));
    const direction = $("powerRouteSelect")?.value || "vertical";
    const lane = Math.min(10, Math.max(3, cellW * .16));
    const boxes = [];
    const rects = [];
    const labels = [];
    for (let r = 0; r < rows; r++) {
        boxes[r] = [];
        for (let c = 0; c < cols; c++) {
            const cell = matrix[r][c];
            const x = startX + c * cellW;
            const y = rowY[r];
            const h = rowHeights[r];
            const isPowerOnly = mode === "power";
            const fill = isPowerOnly ? "rgba(232,56,44,.08)" : topologyFill(matrix, cell);
            const stroke = isPowerOnly ? "#e8382c" : dataBorderColor();
            boxes[r][c] = {
                x,
                y,
                w: cellW,
                h,
                cx: x + cellW / 2,
                cy: y + h / 2,
                r,
                c,
                cell,
                box: { left: x, top: y, right: x + cellW, bottom: y + h, width: cellW, height: h }
            };
            rects.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellW.toFixed(2)}" height="${h.toFixed(2)}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`);
            const text = isPowerOnly ? cell.powerLabel : cell.portLabel;
            labels.push(`<text x="${(x + cellW / 2).toFixed(2)}" y="${(y + h / 2 + labelFontSize * .3).toFixed(2)}" text-anchor="middle" font-size="${labelFontSize.toFixed(1)}" font-weight="700" fill="#0f172a">${escapeHtml(text || "")}</text>`);
        }
    }
    // Render cable paths - for "both" mode, draw power AND data cables
    const allPaths = [];
    const drawCables = (cableMode, laneSign, strokeFn) => {
        const groups = cableGroups(matrix, cableMode);
        Object.values(groups).forEach(points => {
            points.sort((a, b) => a.seq - b.seq);
            const stroke = typeof strokeFn === "function" ? strokeFn(points[0]) : strokeFn;
            for (let i = 1; i < points.length; i++) {
                const aBox = boxes[points[i - 1].r]?.[points[i - 1].c];
                const bBox = boxes[points[i].r]?.[points[i].c];
                if (!aBox || !bBox) continue;
                const sideLane = laneSign * lane;
                const a = { x: direction === "vertical" ? aBox.cx + sideLane : aBox.cx, y: direction === "vertical" ? aBox.cy : aBox.cy + sideLane, r: aBox.r, c: aBox.c, box: aBox.box };
                const b = { x: direction === "vertical" ? bBox.cx + sideLane : bBox.cx, y: direction === "vertical" ? bBox.cy : bBox.cy + sideLane, r: bBox.r, c: bBox.c, box: bBox.box };
                allPaths.push(`<path d="${routedWirePath(a, b, direction, sideLane)}" fill="none" stroke="${stroke}" stroke-width="${cableMode === "power" ? 2.4 : 2}" stroke-linecap="round" stroke-linejoin="round" opacity=".88"/>`);
            }
        });
    };

    if (mode === "both") {
        drawCables("power", -1, "#b91c1c");
        drawCables("data", 1, "#1e80ff");
    } else if (mode === "power") {
        drawCables("power", -1, "#b91c1c");
    } else {
        drawCables("data", 1, "#1e80ff");
    }

    const title = mode === "both" ? "Power & Data Topology" : mode === "power" ? "Power Mapping" : "Data Topology";
    const titleY = pad + 4;
    return `<svg class="appendix-svg" viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="${viewW - 2}" height="${viewH - 2}" rx="12" fill="#fff" stroke="#d8e0eb"/>
        <text x="${pad}" y="${titleY}" font-size="15" font-weight="800" fill="#111827">${title}</text>
        <text x="${viewW - pad}" y="${titleY}" text-anchor="end" font-size="9" fill="#64748b">${escapeHtml(state.model)} / ${cols} x ${physicalSize().displayRows}</text>
        ${rects.join("")}${allPaths.join("")}${labels.join("")}
    </svg>`;
}
function appendixProcessorSvg(page) {
    const canvas = state.mappingReport?.masterCanvas || { key: $("canvasSelect").value, width: 3840, height: 2160 };
    const cols = Math.max(1, Math.floor(number(page.canvasCols, 1)));
    const rows = Math.max(1, Math.floor(number(page.canvasRows, 1)));
    const rowRatios = Array.isArray(page.rowRatios) && page.rowRatios.length ? page.rowRatios : Array.from({ length: rows }, () => 1);
    const ratioTotal = rowRatios.reduce((sum, value) => sum + number(value, 1), 0);

    // Same tight-scaling as appendixMatrixSvg
    const pad = 16;
    const titleH = 32;
    const availW = 560;
    const availH = 680;
    const cellWFromW = (availW - pad * 2) / cols;
    const cellWFromH = ratioTotal > 0 ? (availH - pad * 2 - titleH) / ratioTotal : cellWFromW;
    const cellW = Math.min(cellWFromW, cellWFromH);
    const rowHeights = rowRatios.map(ratio => number(ratio, 1) * cellW);
    const gridW = cols * cellW;
    const gridH = rowHeights.reduce((sum, value) => sum + value, 0);
    const labelFontSize = Math.max(5.5, Math.min(10, cellW * 0.28));
    const viewW = gridW + pad * 2;
    const viewH = titleH + pad + gridH + pad;
    const startX = pad;
    const startY = titleH + pad;
    const rowY = [startY];
    rowHeights.forEach(height => rowY.push(rowY[rowY.length - 1] + height));
    const occupied = new Map((page.occupied || []).map(item => [`${item.localRow}|${item.localCol}`, item]));
    const boxes = [];
    const rects = [];
    const labels = [];
    for (let r = 0; r < rows; r++) {
        boxes[r] = [];
        for (let c = 0; c < cols; c++) {
            const item = occupied.get(`${r}|${c}`);
            const x = startX + c * cellW;
            const y = rowY[r];
            const h = rowHeights[r];
            const cid = item?.cell?.controllerId || page.displayIndex + 1;
            boxes[r][c] = { x, y, w: cellW, h, cx: x + cellW / 2, cy: y + h / 2, r, c, item };
            rects.push(`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cellW.toFixed(2)}" height="${h.toFixed(2)}" rx="2" fill="${item ? controllerFill(cid, .28) : "#f8fafc"}" stroke="${item ? controllerStroke(cid) : "#d8e0eb"}" stroke-width=".7"/>`);
            if (item?.cell?.portLabel) {
                labels.push(`<text x="${(x + cellW / 2).toFixed(2)}" y="${(y + h / 2 + labelFontSize * .3).toFixed(2)}" text-anchor="middle" font-size="${labelFontSize.toFixed(1)}" font-weight="700" fill="#0f172a">${escapeHtml(item.cell.portLabel)}</text>`);
            }
        }
    }
    const groups = {};
    (page.occupied || []).forEach(item => {
        const match = String(item.cell?.portLabel || "").match(/D(\d+)-(\d+)/);
        if (!match) return;
        if (!groups[match[1]]) groups[match[1]] = [];
        groups[match[1]].push({ r: item.localRow, c: item.localCol, seq: Number(match[2]) });
    });
    const paths = [];
    Object.values(groups).forEach(points => {
        points.sort((a, b) => a.seq - b.seq);
        for (let i = 1; i < points.length; i++) {
            const aBox = boxes[points[i - 1].r]?.[points[i - 1].c];
            const bBox = boxes[points[i].r]?.[points[i].c];
            if (!aBox || !bBox) continue;
            paths.push(`<path d="${svgPathBetween({ x: aBox.cx, y: aBox.cy, r: aBox.r, c: aBox.c }, { x: bBox.cx, y: bBox.cy, r: bBox.r, c: bBox.c })}" fill="none" stroke="#0057b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`);
        }
    });
    const procTitleY = pad + 4;
    return `<svg class="appendix-svg" viewBox="0 0 ${viewW} ${viewH}" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="${viewW - 2}" height="${viewH - 2}" rx="12" fill="#fff" stroke="#d8e0eb"/>
        <text x="${pad}" y="${procTitleY}" font-size="14" font-weight="800" fill="#111827">${escapeHtml($("systemSelect").value)} ${escapeHtml(page.title || "Processor")} / ${escapeHtml(canvas.key || $("canvasSelect").value)}</text>
        <text x="${viewW - pad}" y="${procTitleY}" text-anchor="end" font-size="8" fill="#64748b">${escapeHtml(canvas.width || "-")} x ${escapeHtml(canvas.height || "-")} px | Ports: ${escapeHtml(page.portCount || 0)}</text>
        ${rects.join("")}${paths.join("")}${labels.join("")}
    </svg>`;
}
function appendixPage(title, cards, svg) {
    return `<section class="a4-page wiring-appendix">
        <div class="letterhead-header"><img src="images/roe-letterhead-header.png" alt="ROE Visual"></div>
        <header><strong>${escapeHtml(title)}</strong><span>${escapeHtml(state.model)} / ${escapeHtml($("systemSelect").value)} ${escapeHtml($("bandwidthSelect").value)}</span></header>
        <div class="appendix-summary">${appendixCards(cards)}</div>
        ${svg}
        <footer class="letterhead-footer">
            <div class="footer-left">
                <div class="footer-brand">ROE Visual Co., Ltd.</div>
                <div>No.6, Lanjing North Road, Pingshan,</div>
                <div>Shenzhen, China</div>
            </div>
            <div class="footer-right">
                <div>T: +86-755-83924892</div>
                <div>E: roe@roevisual.com</div>
                <div>www.roevisual.com</div>
            </div>
        </footer>
    </section>`;
}
function cloneWiringPages() {
    const target = $("wiringPages");
    const frame = $("mappingFrame");
    if (!target || !frame) return;
    if (frame.parentElement !== target) target.appendChild(frame);
    const frameDocument = frame.contentDocument;
    if (!frameDocument?.body) return;
    frameDocument.body.classList.add("embedded-report");
    const pages = [...frameDocument.querySelectorAll(".right-panel .a4-page")];
    const rawHeight = Math.max(1120, pages.reduce((sum, page) => sum + page.offsetHeight + 20, 0));
    const availableWidth = target.clientWidth || document.querySelector(".paper")?.clientWidth || 794;
    const scale = Math.min(1, availableWidth / 794);
    frame.style.width = "794px";
    frame.style.height = `${rawHeight}px`;
    frame.style.transform = `scale(${scale})`;
    frame.style.transformOrigin = "top left";
    target.style.height = `${Math.ceil(rawHeight * scale)}px`;
    setTimeout(() => {
        frame.contentWindow?.drawCablingLines?.();
        frame.contentWindow?.drawPowerMappingLines?.();
        frame.contentWindow?.fitA4Pages?.();
    }, 0);
}
function quoteExportRows() {
    const rows = [];
    const items = computeItems();
    const grouped = new Map(sectionOrder.map(section => [section, []]));
    items.forEach(item => grouped.get(item.section)?.push(item));
    grouped.forEach((group, section) => {
        if (!group.length) return;
        rows.push({ section });
        group.forEach(item => {
            const qty = state.qtyOverrides.has(item.key) ? state.qtyOverrides.get(item.key) : item.qty;
            const price = discountedPrice(item);
            rows.push({
                product: item.title,
                description: item.desc,
                sap: item.sap || "",
                qty,
                unit: item.unit,
                unitPrice: price,
                extended: qty * price
            });
        });
    });
    return rows;
}
function exportQuoteExcel() {
    const headers = ["Section/Product", "Description"];
    if (state.showSap) headers.push("SAP");
    headers.push("Quantity", "Unit");
    if (state.showPrice) headers.push("Unit Price", "Extended Price");
    const body = quoteExportRows().map(row => {
        if (row.section) return `<tr><td colspan="${headers.length}"><strong>${escapeHtml(row.section)}</strong></td></tr>`;
        const cells = [row.product, row.description];
        if (state.showSap) cells.push(row.sap);
        cells.push(row.qty, row.unit);
        if (state.showPrice) cells.push(row.unitPrice.toFixed(2), row.extended.toFixed(2));
        return `<tr>${cells.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeModelFile(state.model)}-quotation.xls`;
    a.click();
    URL.revokeObjectURL(url);
}
function loadPdfImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}
async function waitForMappingPdfRuntime(timeoutMs = 6000) {
    const frame = $("mappingFrame");
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const win = frame?.contentWindow;
        if (win?.jspdf?.jsPDF && typeof win.appendMappingPdfPages === "function" && state.mappingReport?.matrix?.length) return win;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Mapping report is not ready yet");
}
function quotePdfColumns(pageWidth) {
    const columns = [{ key: "no", label: "NO.", width: 8, align: "center" }];
    if (state.showSap) columns.push({ key: "sap", label: "SAP", width: 25, align: "left" });
    columns.push({ key: "product", label: "Product", width: 0, align: "left" });
    columns.push({ key: "quantity", label: "Quantity", width: 18, align: "right" });
    if (state.showPrice) {
        columns.push({ key: "unitPrice", label: "Unit Price", width: 22, align: "right" });
        columns.push({ key: "extended", label: "Extended Price", width: 27, align: "right" });
    }
    const fixed = columns.reduce((sum, column) => sum + column.width, 0);
    const product = columns.find(column => column.key === "product");
    product.width = Math.max(58, pageWidth - fixed);
    return columns;
}
function drawQuotePdfTableHeader(pdf, columns, x, y) {
    pdf.setFillColor(176, 0, 22);
    pdf.rect(x, y, columns.reduce((sum, column) => sum + column.width, 0), 7, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.2);
    pdf.setTextColor(255, 255, 255);
    let cursor = x;
    columns.forEach(column => {
        const textX = column.align === "right" ? cursor + column.width - 2 : column.align === "center" ? cursor + column.width / 2 : cursor + 2;
        pdf.text(column.label, textX, y + 4.7, { align: column.align });
        cursor += column.width;
    });
    return y + 7;
}
function drawQuotePdfPageStart(pdf, image, continued, columns, pageWidth) {
    const left = 24.5, right = pageWidth - 28;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, 297, "F");
    if (image) pdf.addImage(image, "PNG", 0, 0, 210, 297);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(21, 23, 26);
    pdf.setFontSize(continued ? 12 : 17);
    pdf.text(continued ? "QUOTATION - CONTINUED" : "QUOTATION", left, continued ? 35 : 37);
    if (continued) return drawQuotePdfTableHeader(pdf, columns, left, 40);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text("LED display quotation and technical wiring report", left, 43);
    pdf.setFontSize(7.2);
    pdf.setTextColor(31, 41, 55);
    pdf.text(`Date: ${$("docDate").textContent || "-"}`, right, 35, { align: "right" });
    pdf.text(`Product: ${state.model || "-"}`, right, 39.5, { align: "right" });
    pdf.text(`System: ${$("systemSelect").value} / ${$("bandwidthSelect").value}`, right, 44, { align: "right" });

    const cfg = displayConfig();
    const size = physicalSize();
    const res = resolution();
    const summary = [
        ["Model", state.model || "-"],
        ["Control System", `${$("systemSelect").value} / ${$("bandwidthSelect").value}`],
        ["Display Tiles", `W ${cfg.cols} pcs x H ${size.displayRows} pcs`],
        ["Display Area", `${(size.widthM * size.heightM * 10.7639).toFixed(2)} sq.ft (${(size.widthM * size.heightM).toFixed(2)} sq.m)`],
        ["Display Resolution", res.w && res.h ? `W ${res.w} px x H ${res.h} px` : "TBD"]
    ];
    let summaryY = 50;
    summary.forEach(([label, value], index) => {
        pdf.setDrawColor(176, 0, 22);
        pdf.setLineWidth(.18);
        pdf.rect(left, summaryY, right - left, 6.2);
        pdf.setFillColor(244, 246, 248);
        pdf.rect(left + 49, summaryY, right - left - 49, 6.2, "F");
        pdf.setFont("helvetica", index < 2 ? "bold" : "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(31, 41, 55);
        pdf.text(label, left + 2, summaryY + 4.1);
        pdf.setFont("helvetica", "bold");
        pdf.text(String(value), left + 51, summaryY + 4.1);
        summaryY += 6.2;
    });
    return drawQuotePdfTableHeader(pdf, columns, left, summaryY + 4);
}
async function buildQuotePdf() {
    const mappingWindow = await waitForMappingPdfRuntime();
    const pdf = new mappingWindow.jspdf.jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
    const pageWidth = 210, left = 24.5, contentWidth = 157.5, contentBottom = 268;
    const headerImage = await loadPdfImage("images/roe-letterhead-a4.png").catch(() => null);
    const columns = quotePdfColumns(contentWidth);
    const exportRows = quoteExportRows();
    const productColumn = columns.find(column => column.key === "product");
    let quotePage = 1;
    let y = drawQuotePdfPageStart(pdf, headerImage, false, columns, pageWidth);
    let itemNo = 1;
    let currentSection = "";
    let total = 0;
    const addQuotePage = () => {
        pdf.addPage("a4", "portrait");
        quotePage += 1;
        y = drawQuotePdfPageStart(pdf, headerImage, true, columns, pageWidth);
    };
    const ensureSpace = height => { if (y + height > contentBottom) addQuotePage(); };
    const drawSectionLabel = (label, continued = false) => {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(left, y, contentWidth, 7, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.4);
        pdf.setTextColor(17, 24, 39);
        pdf.text(`${label}${continued ? " - Continued" : ""}`, left + 2, y + 4.6);
        y += 7;
    };
    for (const row of exportRows) {
        if (row.section) {
            currentSection = row.section;
            ensureSpace(7);
            drawSectionLabel(currentSection);
            continue;
        }
        const values = {
            no: String(itemNo++),
            sap: row.sap || "-",
            quantity: `${row.qty} ${row.unit}`,
            unitPrice: currentSection === "Spare Parts for Free" ? "-" : `$${Number(row.unitPrice).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            extended: currentSection === "Spare Parts for Free" ? "-" : `$${Number(row.extended).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        };
        total += row.extended || 0;
        const titleLines = pdf.splitTextToSize(String(row.product || ""), productColumn.width - 4);
        const descriptionLines = pdf.splitTextToSize(String(row.description || ""), productColumn.width - 4);
        const rowHeight = Math.max(9, 3.6 + titleLines.length * 3.2 + descriptionLines.length * 2.8);
        if (y + rowHeight > contentBottom) {
            addQuotePage();
            drawSectionLabel(currentSection, true);
        }
        let cursor = left;
        columns.forEach(column => {
            pdf.setDrawColor(226, 35, 55);
            pdf.setLineWidth(.16);
            pdf.line(cursor, y + rowHeight, cursor + column.width, y + rowHeight);
            if (column.key === "product") {
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(7.1);
                pdf.setTextColor(17, 24, 39);
                pdf.text(titleLines, cursor + 2, y + 4.2);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(6.3);
                pdf.setTextColor(71, 85, 105);
                pdf.text(descriptionLines, cursor + 2, y + 4.2 + titleLines.length * 3.2);
            } else {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(6.7);
                pdf.setTextColor(31, 41, 55);
                const align = column.align;
                const textX = align === "right" ? cursor + column.width - 2 : align === "center" ? cursor + column.width / 2 : cursor + 2;
                pdf.text(values[column.key] || "", textX, y + 4.5, { align, maxWidth: column.width - 4 });
            }
            cursor += column.width;
        });
        y += rowHeight;
    }
    ensureSpace(13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.2);
    pdf.setTextColor(89, 101, 119);
    pdf.text("Freight, taxes, installation, and structural engineering are excluded unless confirmed separately.", left, y + 5, { maxWidth: 115 });
    pdf.setDrawColor(17, 24, 39);
    pdf.setLineWidth(.35);
    pdf.line(pageWidth - 55, y, pageWidth - 15, y);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(17, 24, 39);
    pdf.text(state.showPrice ? `Total  $${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Total  Hidden", pageWidth - 15, y + 5, { align: "right" });
    if (state.showTopology) await mappingWindow.appendMappingPdfPages(pdf, { reuseCurrentPage: false });
    const totalPages = pdf.getNumberOfPages();
    for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
        pdf.setPage(pageNo);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`Page ${pageNo} / ${totalPages}`, pageWidth / 2, 282, { align: "center" });
    }
    return pdf;
}
async function exportQuotePdf() {
    const button = $("exportPdfBtn");
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = "Building PDF...";
    try {
        const pdf = await buildQuotePdf();
        pdf.save(`${safeModelFile(state.model)}-quotation-report.pdf`);
    } catch (error) {
        console.error(error);
        alert(`Unable to export PDF: ${error.message}`);
    } finally {
        button.disabled = false;
        button.textContent = previous;
    }
}

function updateUnitLabels() {
    document.querySelector("#areaInputs .field:nth-child(1) label").textContent = `Wall Width (${activeUnitLabel()})`;
    document.querySelector("#areaInputs .field:nth-child(2) label").textContent = `Wall Height (${activeUnitLabel()})`;
}
function bindEvents() {
    $("carouselPrev").addEventListener("click", () => $("modelCarousel").scrollBy({ left: -420, behavior: "smooth" }));
    $("carouselNext").addEventListener("click", () => $("modelCarousel").scrollBy({ left: 420, behavior: "smooth" }));
    $("productSearchInput").addEventListener("input", event => renderProductSuggestions(event.target.value));
    $("productSearchInput").addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        const matches = allProductMatches(event.target.value);
        if (matches.length) selectProductMatch(matches[0]);
    });
    $("clearProductSearch").addEventListener("click", () => {
        $("productSearchInput").value = "";
        $("productSuggestions").classList.remove("active");
        $("productSearchInput").focus();
    });
    document.querySelectorAll("[data-step-target]").forEach(btn => btn.addEventListener("click", () => {
        const input = $(btn.dataset.stepTarget);
        const delta = number(btn.dataset.delta, 1);
        if (state.sizeMode === "area" && (input.id === "widthM" || input.id === "heightM")) {
            const cabinet = cabinetSize();
            const panelStepM = (input.id === "widthM" ? cabinet.w : cabinet.h) / 1000;
            const currentM = activeUnitToMeters(number(input.value, metersToActiveUnit(panelStepM)));
            const nextM = Math.max(panelStepM, currentM + Math.sign(delta) * panelStepM);
            input.value = metersToActiveUnit(nextM).toFixed(2);
        } else {
            input.value = Math.max(number(input.min, 0), number(input.value, 0) + delta).toFixed(input.step && input.step.includes(".") ? 1 : 0);
        }
        if (state.sizeMode === "area") syncGridFromArea(input.id); else { matchGridToAspect(input.id); syncAreaFromGrid(); }
        renderAll();
    }));
    $("sizeModeTabs").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
        state.sizeMode = btn.dataset.mode;
        $("sizeModeTabs").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === btn));
        $("areaInputs").style.display = state.sizeMode === "area" ? "grid" : "none";
        $("gridInputs").style.display = state.sizeMode === "grid" ? "grid" : "none";
        // Hide unit tabs in Column/Row mode, show in Area mode
        const unitField = document.querySelector("#unitTabs").closest(".field");
        if (unitField) { unitField.style.display = state.sizeMode === "area" ? "" : "none"; }
    }));
    $("unitTabs").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
        const oldWidthM = activeUnitToMeters(number($("widthM").value, 1));
        const oldHeightM = activeUnitToMeters(number($("heightM").value, 1));
        state.unit = btn.dataset.unit;
        $("unitTabs").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === btn));
        setAreaInputs(oldWidthM, oldHeightM);
        updateUnitLabels();
        renderAll();
    }));
    $("aspectTabs").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
        state.aspect = btn.dataset.aspect;
        $("aspectTabs").querySelectorAll("button").forEach(item => item.classList.toggle("active", item === btn));
        if (state.sizeMode === "area") syncGridFromArea("widthM");
        else { matchGridToAspect("colsInput"); syncAreaFromGrid(); }
        renderAll();
    }));
    $("halfRowToggle").addEventListener("click", () => {
        if (!availableSizes().has("Half")) return;
        state.halfRowEnabled = !state.halfRowEnabled;
        syncAreaFromGrid();
        renderAll();
    });
    ["widthM", "heightM"].forEach(id => $(id).addEventListener("input", () => { syncGridFromArea(id); renderAll(); }));
    ["colsInput", "rowsInput"].forEach(id => $(id).addEventListener("input", () => { matchGridToAspect(id); syncAreaFromGrid(); renderAll(); }));
    ["voltageSelect", "currentSelect", "powerRouteSelect", "powerCableLength", "bitRateSelect", "canvasSelect"].forEach(id => {
        $(id).addEventListener("input", () => renderAll());
        $(id).addEventListener("change", () => renderAll());
    });
    $("systemSelect").addEventListener("change", () => { populateBandwidth(); renderAll(); });
    $("bandwidthSelect").addEventListener("change", () => renderAll());
    $("backPageBtn").addEventListener("click", () => {
        const index = pages.findIndex(page => page.id === state.page);
        if (index > 0) setPage(pages[index - 1].id);
    });
    $("nextPageBtn").addEventListener("click", () => {
        const index = pages.findIndex(page => page.id === state.page);
        if (index === pages.length - 1) return;
        setPage(pages[index + 1].id);
    });
    $("showSapToggle").addEventListener("change", event => { state.showSap = event.target.checked; renderQuote(); });
    $("showPriceToggle").addEventListener("change", event => { state.showPrice = event.target.checked; renderQuote(); });
    $("showTopologyToggle").addEventListener("change", event => {
        state.showTopology = event.target.checked;
        document.body.classList.toggle("show-wiring", state.showTopology);
        if (state.showTopology) cloneWiringPages();
    });
    $("discountInput").addEventListener("input", event => { state.discount = Math.max(0, Math.min(100, number(event.target.value, 0))); renderQuote(); });
    $("exportExcelBtn").addEventListener("click", exportQuoteExcel);
    $("exportPdfBtn").addEventListener("click", exportQuotePdf);
    $("mappingFrame").addEventListener("load", () => { state.iframeReady = true; syncMapping(); });
    window.addEventListener("message", event => {
        if (event.data?.type !== "MAPPING_REPORT") return;
        state.mappingReport = event.data.report;
        renderAll(false);
        setTimeout(cloneWiringPages, 80);
    });
}

bindEvents();
$("docDate").textContent = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
Promise.all([
    fetch("Spare_Parts.json").then(response => response.json()),
    fetch("images/product-image-map.json").then(response => response.json()).catch(() => ({}))
])
    .then(([data, productImages]) => {
        state.rows = data;
        state.productImages = productImages || {};
        deriveFields(data);
        const initialModels = modelsForCategory(true);
        state.model = initialModels.includes("CRS1.2") ? "CRS1.2" : initialModels[0] || "";
        ensureModelSelection();
        populateSystems();
        populateBandwidth();
        applyDefaultProcessingCanvas();
        updateUnitLabels();
        syncGridFromArea();
        renderAll();
        setPage("product");
    })
    .catch(error => {
        document.body.innerHTML = `<div style="padding:30px;color:white;">Unable to load Spare_Parts.json: ${escapeHtml(error.message)}</div>`;
    });
