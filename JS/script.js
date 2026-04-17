       /* ================= CONFIGURATION ================= */
        var CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSoPJmFD2PgIQ5xCLPa3GMXxqgXYPGnuhApo4bE8ZWGSN8orekzv9LDL8M3-WevPGMFs0NwREroNjBT/pub?output=csv";
        var DATA = [], NOW = new Date(), CUR_YEAR = NOW.getFullYear(), CUR_MONTH = String(NOW.getMonth() + 1).padStart(2, '0');
        
        var timeState = { detail: CUR_MONTH, calendar: CUR_MONTH };
        
        var CO_CAU = {
            "PHÒNG 1": ["UY", "TRÍ"],
            "PHÒNG 2": ["CÓ", "LONG"],
            "PHÒNG 3": ["TRANG", "DANH"],
            "BANCA - PA": ["BANCA"]
        };
        
        var MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        var FUNCS = [
            { id: "Q1", n: "Quý 1", ms: ["01", "02", "03"] },
            { id: "Q2", n: "Quý 2", ms: ["04", "05", "06"] },
            { id: "Q3", n: "Quý 3", ms: ["07", "08", "09"] },
            { id: "Q4", n: "Quý 4", ms: ["10", "11", "12"] },
            { id: "Y", n: "Cả năm", ms: "ALL" }
        ];

        /* ================= UTILITIES ================= */
        var $ = function(id) { return document.getElementById(id); };
        var num = function(v) { return Number(v) || 0; };
        var fmt = function(n) { return new Intl.NumberFormat('vi-VN').format(n); };
        function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

        function animateValue(el, end, dur) {
            if (!dur) dur = 900;
            if (!end) { el.textContent = fmt(end); return; }
            var start = 0;
            var st = null;
            var step = function(ts) {
                if (!st) st = ts;
                var p = Math.min((ts - st) / dur, 1);
                // EaseOutCubic
                var ease = 1 - Math.pow(1 - p, 3);
                el.textContent = fmt(Math.floor(end * ease));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }

        function animatePct(el, target, dur, dec) {
            if (!dur) dur = 900;
            if (dec === undefined) dec = 0;
            var st = null;
            var step = function(ts) {
                if (!st) st = ts;
                var p = Math.min((ts - st) / dur, 1);
                var ease = 1 - Math.pow(1 - p, 3);
                el.textContent = (target * ease).toFixed(dec) + '%';
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        }

        function toast(msg, type) {
            var c = document.querySelector('.tw'); 
            if(!c) return; // Only works inside td-page views or create a global toast container
            // Simple fallback for main view if needed, but main view doesn't use toast() much currently.
            // Assuming toast is called from Race/Policy context mainly.
            
            var t = document.createElement('div');
            t.className = 'ts ' + (type === 'err' ? 'err' : type === 'ok' ? 'ok' : '');
            var ic = { ok: 'fa-circle-check', err: 'fa-circle-exclamation', info: 'fa-circle-info' };
            var cl = { ok: '#27ae60', err: 'var(--td-red)', info: 'var(--td-accent)' };
            
            t.innerHTML = '<i class="fa-solid ' + (ic[type] || ic.info) + '" style="color:' + (cl[type] || cl.info) + '"></i>' + esc(msg);
            c.appendChild(t);
            requestAnimationFrame(function() { requestAnimationFrame(function() { t.classList.add('show'); }); });
            setTimeout(function() {
                t.classList.remove('show');
                setTimeout(function() { t.remove(); }, 400);
            }, 3500);
        }

        /* ================= NAVIGATION ================= */
        function go(viewId) {
            document.body.style.overflow = '';
            
            // Close modals if any are open
            [tdPage, poPage].forEach(function(pg) {
                if (!pg) return;
                ['PwMdl', 'CfmDel', 'Mdl', 'Popup'].forEach(function(s) {
                    var el = pg.gid(s);
                    if (el) el.classList.remove('open');
                });
            });

            document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });
            $(viewId).classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (viewId === 'view-detail') {
                renderDtPicker();
                renderDetail();
            } else if (viewId === 'view-calendar') {
                renderCalFilter();
                renderCalendar();
            } else if (viewId === 'view-race') {
                tdPage.init();
            } else if (viewId === 'view-policy') {
                poPage.init();
            }
        }

        /* ================= MAIN DASHBOARD LOGIC ================= */
        function pctColor(p) {
            return '#f2d38d';
        }
        function glowCls(pct) { return pct >= 100 ? ' glow-full' : ''; }
        function miniProgressHTML(cp, extraCls) {
            return '<div class="mini-progress ' + (extraCls || '') + '"><div class="mini-progress-fill" data-w="' + cp + '%"></div></div>';
        }

        function progressColor(pct) {
            var p = Math.max(0, Math.min(100, pct || 0));
            var hue = 0 + (120 * (p / 100));
            return 'hsl(' + hue + ', 68%, 52%)';
        }
        var DATA_CACHE_KEY = 'kpi-bvnt-ag-data-cache-v1';

        function saveDataCache(rows) {
            try {
                localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({
                    ts: Date.now(),
                    rows: rows || []
                }));
            } catch (e) {}
        }

        function loadDataCache() {
            try {
                var raw = localStorage.getItem(DATA_CACHE_KEY);
                if (!raw) return null;
                var parsed = JSON.parse(raw);
                if (!parsed || !Array.isArray(parsed.rows) || !parsed.rows.length) return null;
                return parsed.rows;
            } catch (e) {
                return null;
            }
        }

        function formatKyLabel(ky) {
            if (!ky) return '--';
            var v = String(ky).trim();
            var monthMatch = v.match(/(\d{2})$/);
            if (/Q[1-4]$/i.test(v)) return v.match(/Q[1-4]$/i)[0].toUpperCase();
            if (/(?:H1|6T)$/i.test(v)) return '6T';
            if (/(?:Y|NAM|NĂM)$/i.test(v)) return 'Năm';
            if (/^\d{4}-\d{2}$/.test(v) && monthMatch) return monthMatch[1];
            if (/^\d{2}$/.test(v)) return v;
            return v.replace(/^\d{4}-/, '');
        }

        function kySortWeight(ky) {
            var label = formatKyLabel(ky);
            if (/^\d{2}$/.test(label)) return parseInt(label, 10);
            if (/^Q[1-4]$/i.test(label)) return 20 + parseInt(label.slice(1), 10);
            if (label === '6T') return 30;
            if (label === 'Năm') return 31;
            return 99;
        }

        function renderKySelect(kyList, selectedKy) {
            var wrap = $('select-ky-wrap');
            var btn = $('select-ky');
            var menu = $('select-ky-menu');
            if (!wrap || !btn || !menu) return;

            btn.textContent = formatKyLabel(selectedKy || kyList[0] || '--');
            btn.dataset.value = selectedKy || '';
            btn.setAttribute('aria-expanded', wrap.classList.contains('open') ? 'true' : 'false');
            menu.innerHTML = kyList.map(function(ky) {
                return '<button type="button" class="ctrl-select-opt ' + (ky === selectedKy ? 'on' : '') + '" data-ky="' + esc(ky) + '">' + esc(formatKyLabel(ky)) + '</button>';
            }).join('');

            menu.querySelectorAll('.ctrl-select-opt').forEach(function(opt) {
                opt.addEventListener('click', function() {
                    var ky = opt.getAttribute('data-ky');
                    wrap.classList.remove('open');
                    btn.setAttribute('aria-expanded', 'false');
                    renderKySelect(kyList, ky);
                    renderMain(ky);
                });
            });
        }

        function syncData() {
            var btn = $('sync-btn');
            btn.classList.add('loading');
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Đang tải...';

            var cachedRows = loadDataCache();
            if (cachedRows && cachedRows.length) {
                DATA = cachedRows;
                $('skeleton-main').style.display = 'none';
                initApp();
            } else {
                $('skeleton-main').style.display = '';
            }
            $('error-main').style.display = 'none';
            $('kpi-company').style.display = 'none';
            $('nav-grid').style.display = 'none';
            $('sec-divider').style.display = 'none';
            $('main-content').style.display = 'none';
            if ($('link-divider')) $('link-divider').style.display = 'none';
            if ($('link-grid')) $('link-grid').style.display = 'none';

            Papa.parse(CSV_URL + '&t=' + Date.now(), {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(res) {
                    DATA = res.data;
                    saveDataCache(DATA);
                    btn.classList.remove('loading');
                    btn.innerHTML = '<i class="fa-solid fa-rotate mr-1"></i> Đồng bộ';
                    $('skeleton-main').style.display = 'none';
                    
                    if (!DATA.length) {
                        $('error-main').style.display = '';
                        return;
                    }
                    initApp();
                },
                error: function() {
                    btn.classList.remove('loading');
                    btn.innerHTML = '<i class="fa-solid fa-rotate mr-1"></i> Đồng bộ';
                    $('skeleton-main').style.display = 'none';
                    $('error-main').style.display = '';
                }
            });
        }

        function initApp() {
            var kyList = [], seen = {};
            DATA.forEach(function(x) {
                if (x.ky && x.ky.indexOf(CUR_YEAR.toString()) !== -1 && !seen[x.ky]) {
                    seen[x.ky] = true;
                    kyList.push(x.ky);
                }
            });
            kyList.sort(function(a, b) { return kySortWeight(a) - kySortWeight(b); });
            
            var dk = CUR_YEAR + '-' + CUR_MONTH;
            var selectedKy = kyList.indexOf(dk) !== -1 ? dk : (kyList[0] || '');
            renderKySelect(kyList, selectedKy);
            renderMain(selectedKy);

            var wrap = $('select-ky-wrap');
            var btn = $('select-ky');
            if (wrap && btn && !wrap.dataset.bound) {
                btn.addEventListener('click', function() {
                    var isOpen = wrap.classList.toggle('open');
                    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                });
                document.addEventListener('click', function(e) {
                    if (!wrap.contains(e.target)) {
                        wrap.classList.remove('open');
                        btn.setAttribute('aria-expanded', 'false');
                    }
                });
                wrap.dataset.bound = '1';
            }
        }

        function renderNoticeBar(ky) {
            var bar = $('notice-bar');
            if (!bar) return;

            var seen = {}, items = [];
            DATA.forEach(function(x) {
                var msg = (x.thong_bao || '').trim();
                if (!msg) return;
                if (ky && x.ky && x.ky !== ky) return;
                if (!seen[msg]) {
                    seen[msg] = true;
                    items.push(msg);
                }
            });

            if (!items.length) {
                bar.classList.remove('show');
                bar.innerHTML = '';
                return;
            }

            var html = items.map(function(msg) {
                return '<span class="notice-item"><i class="fa-solid fa-bullhorn"></i><span>' + esc(msg) + '</span></span>';
            }).join('');

            bar.innerHTML = '<div class="notice-track">' + html + html + '</div>';
            bar.classList.add('show');
        }

        function renderLinkButtons(ky) {
            var divider = $('link-divider');
            var grid = $('link-grid');
            if (!divider || !grid) return;

            var seen = {}, items = [];
            DATA.forEach(function(x) {
                if (ky && x.ky && x.ky !== ky) return;
                var name = (x.ten_nhan_vien || '').trim();
                var link = (x.lien_ket || '').trim();
                if (!name || !/^X/i.test(name) || !link) return;

                var label = name.replace(/^X[\s._:-]*/i, '').trim() || name;
                var key = label + '|' + link;
                if (seen[key]) return;
                seen[key] = true;
                items.push({ label: label, link: link });
            });

            if (!items.length) {
                divider.style.display = 'none';
                grid.style.display = 'none';
                grid.innerHTML = '';
                return;
            }

            grid.innerHTML = items.map(function(item) {
                return '<a class="link-btn" href="' + esc(item.link) + '" target="_blank" rel="noopener noreferrer">' +
                    '<i class="fa-solid fa-arrow-up-right-from-square"></i><span>' + esc(item.label) + '</span></a>';
            }).join('');
            divider.style.display = '';
            grid.style.display = 'grid';
        }

        function renderMain(ky) {
            var list = DATA.filter(function(x) { return x.ky === ky && x.ten_nhan_vien; });
            var box = $('main-content'), ctyBox = $('kpi-company');
            ctyBox.innerHTML = '';
            renderNoticeBar(ky);
            renderLinkButtons(ky);
            
            $('kpi-company').style.display = '';
            $('nav-grid').style.display = '';
            $('sec-divider').style.display = '';
            $('main-content').style.display = '';

            var total = { ten: 'Công Ty', afyp: 0, kh: 0, lhd: 0, td: 0, hdChuan: 0 }, delay = 0;
            var htmlParts = [];

            for (let pName in CO_CAU) {
                let p = { ten: pName, afyp: 0, kh: 0, lhd: 0, td: 0, hdChuan: 0, ads: [], noAds: pName === 'BANCA - PA' };
                
                CO_CAU[pName].forEach(function(adKey) {
                    var row = list.find(function(x) { return x.ten_nhan_vien && x.ten_nhan_vien.toUpperCase().indexOf(adKey) !== -1; });
                    if (row) {
                        var d = {
                            ten: row.ten_nhan_vien,
                            afyp: num(row.afyp),
                            kh: num(row.ke_hoach_afyp),
                            lhd: num(row.luot_hoa_dong),
                            td: num(row.tuyen_dung),
                            hdChuan: num(row.luot_hd_chuan)
                        };
                        p.ads.push(d);
                        p.afyp += d.afyp;
                        p.kh += d.kh;
                        p.lhd += d.lhd;
                        p.td += d.td;
                        p.hdChuan += d.hdChuan;
                    }
                });

                htmlParts.push(buildPhongCard(p, delay));
                delay += 60;

                if (!p.noAds) {
                    var adHtml = '<div class="ad-grid">';
                    p.ads.forEach(function(ad) {
                        adHtml += buildAdCard(ad, delay);
                        delay += 30;
                    });
                    adHtml += '</div>';
                    htmlParts.push(adHtml);
                }
                delay += 60;

                total.afyp += p.afyp;
                total.kh += p.kh;
                total.lhd += p.lhd;
                total.td += p.td;
                total.hdChuan += p.hdChuan;
            }

            box.innerHTML = htmlParts.join('');
            ctyBox.innerHTML = buildCtyCard(total);
            triggerAnimations();
        }

        function subsHTML(lhd, td, hdc, cls) {
            var c = cls || '';
            return '<div class="subs-row ' + c + '">' +
                '<div class="sub-pill"><span class="sub-label">Lượt HĐ</span> <span class="sub-num" data-count="' + lhd + '">0</span></div>' +
                '<div class="sub-pill"><span class="sub-label">Tuyển dụng</span> <span class="sub-num" data-count="' + td + '">0</span></div>' +
                '<div class="sub-pill"><span class="sub-label">HĐ chuẩn</span> <span class="sub-num" data-count="' + hdc + '">0</span></div>' +
                '</div>';
        }

        function buildCtyCard(item) {
            var pct = item.kh ? (item.afyp / item.kh * 100) : 0, cp = Math.min(pct, 100), pc = pctColor(pct);
            return '<div class="kpi-card kpi-cty anim-in' + glowCls(pct) + '">' +
                '<div class="cty-inner">' +
                '<div class="cty-head">' +
                '<div class="cty-name"><i class="fa-solid fa-trophy"></i><span>Tổng Công Ty</span></div>' +
                '<div class="cty-pct-num" data-pct="' + pct + '">0%</div>' +
                '</div>' +
                '<div class="cty-body">' +
                '<div class="afyp-kh-row">' +
                '<span class="afyp-big" data-count="' + item.afyp + '">0</span>' +
                '<span class="kh-small">/ KH: ' + fmt(item.kh) + '</span>' +
                '</div>' +
                '<div class="cty-progress"><div class="cty-progress-fill" data-w="' + cp + '%"></div></div>' +
                '</div>' +
                '<div class="cty-stats">' +
                '<div class="cty-stat hd"><div class="cty-stat-label">Lượt HĐ</div><div class="cty-stat-val" data-count="' + item.lhd + '">0</div></div>' +
                '<div class="cty-stat td"><div class="cty-stat-label">TD</div><div class="cty-stat-val" data-count="' + item.td + '">0</div></div>' +
                '<div class="cty-stat chuan"><div class="cty-stat-label">Lượt chuẩn</div><div class="cty-stat-val" data-count="' + item.hdChuan + '">0</div></div>' +
                '</div>' +
                '</div>' +
                '</div>';
        }

        function buildPhongCard(item, delay) {
            var hasPlan = !item.noAds;
            var pct = hasPlan && item.kh ? (item.afyp / item.kh * 100) : 0, cp = Math.min(pct, 100), pc = pctColor(pct);
            return '<div class="kpi-card kpi-phong ' + (item.noAds ? 'banca ' : '') + 'anim-in' + glowCls(pct) + '" style="animation-delay:' + delay + 'ms">' +
                '<div class="phong-inner">' +
                '<div class="phong-head">' +
                '<span class="phong-name"><i class="fa-solid fa-clipboard"></i>Tổng hợp ' + item.ten + '</span>' +
                (hasPlan ? '<span class="phong-pct" data-pct="' + pct + '">0%</span>' : '') +
                '</div>' +
                '<div class="phong-body">' +
                '<div class="afyp-kh-row">' +
                '<span class="afyp-big" data-count="' + item.afyp + '">0</span>' +
                (hasPlan ? '<span class="kh-small">/ KH: ' + fmt(item.kh) + '</span>' : '') +
                '</div>' +
                (hasPlan ? '<div class="phong-progress"><div class="phong-progress-fill" data-w="' + cp + '%"></div></div>' : '') +
                '</div>' +
                '<div class="phong-stats">' +
                '<div class="phong-stat hd"><div class="phong-stat-label">Lượt HĐ</div><div class="phong-stat-val" data-count="' + item.lhd + '">0</div></div>' +
                (hasPlan ? '<div class="phong-stat td"><div class="phong-stat-label">TD</div><div class="phong-stat-val" data-count="' + item.td + '">0</div></div>' : '') +
                '<div class="phong-stat chuan"><div class="phong-stat-label">Lượt chuẩn</div><div class="phong-stat-val" data-count="' + item.hdChuan + '">0</div></div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>';
        }

        function buildAdCard(item, delay) {
            var pct = item.kh ? (item.afyp / item.kh * 100) : 0, cp = Math.min(pct, 100);
            var progStart = progressColor(Math.max(pct - 24, 0));
            var progEnd = progressColor(pct);
            return '<div class="kpi-ad anim-in' + glowCls(pct) + '" style="animation-delay:' + delay + 'ms">' +
                '<div class="ad-inner">' +
                '<div class="ad-top">' +
                '<div class="ad-left">' +
                '<div class="ad-name-row"><span class="ad-name" title="'+esc(item.ten)+'">' + esc(item.ten) + '</span><span class="ad-pct">' + pct.toFixed(0) + '%</span></div>' +
                '<span class="ad-kh">KH: ' + fmt(item.kh) + 'trđ</span>' +
                '</div>' +
                '<div class="ad-right"><div class="ad-stats">' +
                '<div class="ad-stat afyp"><span class="ad-stat-label">AFYP</span><span class="ad-stat-val"><span class="ad-stat-val-main" data-count="' + (num(item.afyp) / 1000000).toFixed(1) + '">0</span><span class="ad-stat-unit">trđ</span></span></div>' +
                '<div class="ad-stat lhd"><span class="ad-stat-label">Lượt HĐ</span><span class="ad-stat-val" data-count="' + item.lhd + '">0</span></div>' +
                '<div class="ad-stat td"><span class="ad-stat-label">TD</span><span class="ad-stat-val" data-count="' + item.td + '">0</span></div>' +
                '<div class="ad-stat chuan"><span class="ad-stat-label">L.Chuẩn</span><span class="ad-stat-val" data-count="' + item.hdChuan + '">0</span></div>' +
                '</div>' +
                '<div class="ad-progress"><div class="ad-progress-fill" data-w="' + cp + '%" style="background:linear-gradient(90deg,' + progStart + ',' + progEnd + ')"></div></div></div>' +
                '</div>' +
                '</div>' +
                '</div>';
        }

        function triggerAnimations() {
            requestAnimationFrame(function() {
                document.querySelectorAll('.mini-progress-fill[data-w]').forEach(function(el) {
                    el.style.width = el.dataset.w;
                });
                document.querySelectorAll('.cty-progress-fill[data-w]').forEach(function(el) {
                    el.style.width = el.dataset.w;
                });
                document.querySelectorAll('.phong-progress-fill[data-w]').forEach(function(el) {
                    el.style.width = el.dataset.w;
                });
                document.querySelectorAll('.ad-progress-fill[data-w]').forEach(function(el) {
                    el.style.width = el.dataset.w;
                });
                document.querySelectorAll('[data-count]').forEach(function(el) {
                    animateValue(el, num(el.dataset.count));
                });
                document.querySelectorAll('[data-pct]').forEach(function(el) {
                    animatePct(el, parseFloat(el.dataset.pct));
                });
            });
        }

        /* ================= DETAIL VIEW LOGIC ================= */
        function getDetailVal(row, tid) {
            var afyp = 0, kh = 0;
            if (!isNaN(tid)) {
                var m = parseInt(tid);
                afyp = num(row['t' + m]);
                kh = num(row['kh' + m]);
            } else if (tid === 'H1') {
                for (var hm = 1; hm <= 6; hm++) {
                    afyp += num(row['t' + hm]);
                    kh += num(row['kh' + hm]);
                }
            } else if (tid === 'Y') {
                for (var m = 1; m <= 12; m++) {
                    afyp += num(row['t' + m]);
                    kh += num(row['kh' + m]);
                }
            } else {
                var f = FUNCS.find(function(x) { return x.id === tid; });
                if (f) f.ms.forEach(function(m) {
                    afyp += num(row['t' + parseInt(m)]);
                    kh += num(row['kh' + parseInt(m)]);
                });
            }
            return { afyp: afyp, kh: kh };
        }

        function renderDtPicker() {
            var cur = timeState.detail;
            var mBox = $('dt-months'), fBox = $('dt-funcs');
            var mH = '';
            for (var i = 1; i <= 12; i++) {
                var m = String(i).padStart(2, '0');
                mH += '<button class="month-cell ' + (cur === m ? 'on' : '') + '" onclick="pickDt(\'' + m + '\')"><span class="mc-label">T' + i + '</span></button>';
            }
            mH += '<button class="month-cell func-cell-inline ' + (cur === 'H1' ? 'on' : '') + '" onclick="pickDt(\'H1\')" style="font-size:8px;font-weight:800;background:' + (cur === 'H1' ? '' : '#251e47') + ';border-color:' + (cur === 'H1' ? '' : '#3b2b63') + ';color:' + (cur === 'H1' ? '' : '#c4b8f0') + '">6T</button>';
            FUNCS.forEach(function(f) {
                mH += '<button class="month-cell func-cell-inline ' + (cur === f.id ? 'on' : '') + '" onclick="pickDt(\'' + f.id + '\')" style="font-size:8px;font-weight:800;background:' + (cur === f.id ? '' : '#251e47') + ';border-color:' + (cur === f.id ? '' : '#3b2b63') + ';color:' + (cur === f.id ? '' : '#c4b8f0') + '">' + f.n.replace('Quý ', 'Q').replace('Cả năm', 'Năm') + '</button>';
            });
            mBox.classList.add('compact-filter');
            mBox.innerHTML = mH;
            fBox.innerHTML = '';
            fBox.style.display = 'none';
        }

        function getTotalForMonth(m) {
            var total = 0;
            DATA.filter(function(x) { return x.ten_nhan_vien && x.ten_nhan_vien.indexOf('Nhóm') === 0; }).forEach(function(r) {
                total += num(r['t' + m]);
            });
            return total;
        }

        function detailMetaText(t) {
            if (!isNaN(t)) return 'Tháng ' + t + '/' + CUR_YEAR + ' — Chỉ tiêu 8.0% năm';
            if (t === 'H1') return '6 tháng đầu năm ' + CUR_YEAR + ' — Chỉ tiêu 8.0% năm';
            if (t === 'Y') return 'Toàn năm ' + CUR_YEAR + ' — Chỉ tiêu 8.0% năm';
            var f = FUNCS.find(function(x) { return x.id === t; });
            return (f ? f.n + ' ' + CUR_YEAR : 'Tháng ' + CUR_MONTH + '/' + CUR_YEAR) + ' — Chỉ tiêu 8.0% năm';
        }

        window.pickDt = function(v) {
            timeState.detail = v;
            renderDtPicker();
            renderDetail();
        };

        function renderDetail() {
            var box = $('detail-list');
            $('detail-meta').textContent = detailMetaText(timeState.detail);
            var t = timeState.detail;
            var rows = DATA.filter(function(x) { return x.ten_nhan_vien && x.ten_nhan_vien.indexOf('Nhóm') === 0; });
            
            var items = rows.map(function(r) {
                var v = getDetailVal(r, t);
                var name = r.ten_nhan_vien.replace(/^Nhóm\s*/i, '');
                var pct = v.kh ? (v.afyp / v.kh * 100) : 0;
                return { name: name, afyp: v.afyp, kh: v.kh, pct: pct };
            });

            items.sort(function(a, b) { return b.pct - a.pct; });
            renderTop3(items);
            if (!items.length) {
                box.innerHTML = '<div class="empty-state">Chưa có dữ liệu nhóm</div>';
                return;
            }

            var delay = 0;
            var htmlParts = [];
            items.forEach(function(it, idx) {
                var fill = Math.min(it.pct, 100);
                var pc = it.pct >= 90 ? '#7de8c8' : it.pct >= 70 ? '#8fd0ff' : '#7a9bbf';
                htmlParts.push('<div class="grp-item ' + (idx < 3 ? 'is-top' : '') + '" style="animation-delay:' + delay + 'ms">' +
                    '<div class="grp-fill" data-w="' + fill + '%"></div>' +
                    '<div class="grp-top-row">' +
                    '<span class="grp-name">Nhóm ' + esc(it.name) + '</span>' +
                    '<span class="grp-pct" data-pct="' + it.pct + '" style="color:' + pc + '">0%</span>' +
                    '</div>' +
                    '<div class="grp-bot-row">' +
                    '<span class="grp-stats-inline"><span class="grp-stat-main">TH: <span data-count="' + it.afyp + '">0</span>trđ</span><span class="grp-stat-kh">/ KH: ' + fmt(it.kh) + 'trđ</span></span>' +
                    '</div>' +
                    '<div class="grp-prog-row"><div class="grp-prog"><div class="grp-prog-fill" data-w="' + fill + '%"></div></div></div>' +
                    '</div>');
                delay += 40;
            });
            box.innerHTML = htmlParts.join('');

            requestAnimationFrame(function() {
                box.querySelectorAll('.grp-fill[data-w]').forEach(function(el) { el.style.width = el.dataset.w; });
                box.querySelectorAll('.grp-prog-fill[data-w]').forEach(function(el) { el.style.width = el.dataset.w; });
                box.querySelectorAll('[data-count]').forEach(function(el) { animateValue(el, num(el.dataset.count)); });
                box.querySelectorAll('[data-pct]').forEach(function(el) { animatePct(el, parseFloat(el.dataset.pct), 900, 1); });
            });
        }

        function renderTop3(items) {
            var box = $('top3-container');
            if (!items || !items.length) { box.innerHTML = ''; return; }
            
            var filtered = items.filter(function(x) { return x.kh > 0; });
            if (!filtered.length) {
                box.innerHTML = '<div class="top3-empty"><i class="fa-solid fa-chart-simple" style="margin-right:6px;opacity:.4"></i>Chưa có dữ liệu kế hoạch</div>';
                return;
            }

            filtered.sort(function(a, b) { return b.pct - a.pct; });
            var top = filtered.slice(0, 3), order = [null, null, null], cls = ['t3-silver', 't3-gold', 't3-bronze'];
            
            order[0] = top.length > 1 ? top[1] : null; // Silver (Left)
            order[1] = top[0]; // Gold (Center)
            order[2] = top.length > 2 ? top[2] : null; // Bronze (Right)

            var crowns = ['<i class="fa-solid fa-award"></i>', '<i class="fa-solid fa-crown"></i>', '<i class="fa-solid fa-medal"></i>'];
            var h = '<div class="top3-section"><div class="top3-grid">';
            for (var i = 0; i < 3; i++) {
                var item = order[i];
                if (!item) { h += '<div></div>'; continue; }
                var isF = i === 1;
                h += '<div class="top3-card ' + (isF ? 'top3-first ' : '') + cls[i] + '" style="animation-delay:' + (i * 80) + 'ms">' +
                    (isF ? '<div class="top3-crown">' + crowns[i] + '</div>' : '') +
                    '<div class="top3-rank"><span class="top3-rank-num">' + (i === 0 ? '2' : i === 1 ? '1' : '3') + '</span></div>' +
                    '<div class="top3-name">Nhóm ' + esc(item.name) + '</div>' +
                    '<div class="top3-val"><span data-count="' + item.afyp + '">0</span>trđ</div>' +
                    '<div class="top3-bar"></div>' +
                    '<div class="top3-pct">' + item.pct.toFixed(1) + '%</div>' +
                    '</div>';
            }
            h += '</div></div>';
            box.innerHTML = h;

            requestAnimationFrame(function() {
                box.querySelectorAll('[data-count]').forEach(function(el) { animateValue(el, num(el.dataset.count), 800); });
            });
        }

        /* ================= CALENDAR VIEW LOGIC ================= */
        function renderCalendar() {
            var box = $('calendar-body');
            var t = timeState.calendar;
            var selMonths = [];

            if (!isNaN(t)) {
                selMonths = [String(parseInt(t)).padStart(2, '0')];
            } else if (t === 'Y') {
                selMonths = MONTHS.slice();
            } else {
                var f = FUNCS.find(function(x) { return x.id === t; });
                if (f) selMonths = f.ms.slice();
            }

            var rows = DATA.filter(function(x) {
                if (!x.thangkh) return false;
                var m = String(parseInt(x.thangkh)).padStart(2, '0');
                return selMonths.indexOf(m) !== -1;
            }).sort(function(a, b) { return num(a.ngay_kh) - num(b.ngay_kh); });

            if (!selMonths.length) {
                box.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--muted);font-style:italic;font-size:13px">Chưa có kế hoạch cho kỳ này</div>';
                return;
            }

            var month = selMonths[0];
            var monthNum = parseInt(month, 10);
            var daysInMonth = new Date(CUR_YEAR, monthNum, 0).getDate();
            var weekdayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
            var byDay = {};
            var htmlParts = [];

            rows.forEach(function(r) {
                var day = num(r.ngay_kh);
                if (!day || day < 1 || day > daysInMonth) return;
                if (!byDay[day]) byDay[day] = [];
                byDay[day].push(r);
            });

            for (var day = 1; day <= daysInMonth; day++) {
                var dateObj = new Date(CUR_YEAR, monthNum - 1, day);
                var weekday = dateObj.getDay();
                var plans = byDay[day] || [];
                var isToday = day === NOW.getDate() && month === CUR_MONTH;
                var rowCls = ['cal-row'];
                if (isToday) rowCls.push('is-today');
                if (weekday === 6 || weekday === 0) rowCls.push('is-weekend');
                if (weekday === 0) rowCls.push('is-sunday');

                var contentHtml = plans.length ? plans.map(function(r) {
                    return '<span class="cal-line">' + esc(r.noi_dung || '') + '</span>';
                }).join('') : '<span class="cal-empty"></span>';

                var ownerMap = {}, owners = [];
                plans.forEach(function(r) {
                    var owner = (r.phu_trach || '').trim();
                    if (owner && !ownerMap[owner]) {
                        ownerMap[owner] = true;
                        owners.push(owner);
                    }
                });
                var ownerHtml = owners.length ? owners.map(function(owner) {
                    return '<span class="cal-line">' + esc(owner) + '</span>';
                }).join('') : '';

                htmlParts.push('<div class="' + rowCls.join(' ') + '" style="animation-delay:' + ((day - 1) * 22) + 'ms">' +
                    '<div class="cal-day"><span class="cal-day-num">' + day + '</span><span class="cal-day-week">' + weekdayNames[weekday] + '</span></div>' +
                    '<div class="cal-text">' + contentHtml + '</div>' +
                    '<div class="cal-owner">' + ownerHtml + '</div>' +
                    '</div>');
            }
            box.innerHTML = htmlParts.join('');
        }

        function renderCalFilter() {
            var cur = timeState.calendar;
            var mBox = $('cal-filter'), fBox = $('cal-func');
            var mH = '';
            for (var i = 1; i <= 12; i++) {
                var m = String(i).padStart(2, '0');
                mH += '<button class="cal-fbtn ' + (cur === m ? 'on' : '') + '" onclick="pickCal(\'' + m + '\')">T' + i + '</button>';
            }
            mBox.innerHTML = mH;
            fBox.innerHTML = '';
            fBox.style.display = 'none';
        }

        window.pickCal = function(v) {
            timeState.calendar = v;
            renderCalFilter();
            renderCalendar();
        };

        /* ================= RACE / POLICY PAGE FACTORY ================= */
        var TD_PW = '922129';
        var TD_SID = '1Mzag5EkMGO8YVnNDbLi7YBxuH3b6nlMknxdHsIuDA60';
        var TD_TAB = 'DanhSach';
        var TD_SCR = 'https://script.google.com/macros/s/AKfycbxuXDIIH5b1snWjaXUK87Kk6wx3Fs1hP4MG7akfhCVx7Cj_wSLJpeAEKcO-uJSadPRb/exec';

        function TD_gdc() { return 'https://docs.google.com/spreadsheets/d/' + TD_SID + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(TD_TAB); }
        function TD_gtc(t) { return 'https://docs.google.com/spreadsheets/d/' + TD_SID + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(t); }
        function TD_gdcAlt() { return 'https://docs.google.com/spreadsheets/d/' + TD_SID + '/export?format=csv&sheet=' + encodeURIComponent(TD_TAB); }
        function TD_gtcAlt(t) { return 'https://docs.google.com/spreadsheets/d/' + TD_SID + '/export?format=csv&sheet=' + encodeURIComponent(t); }
        function TD_csv(text) { if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1); return Papa.parse(text, { header: false, skipEmptyLines: 'greedy' }).data; }
        function TD_fd(d) { if (!d) return '--'; var p = d.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d; }
        function TD_fdi(d) { if (!d) return ''; var p = d.split('/'); if (p.length === 3 && p[2].length === 4) return p[2] + '-' + p[1].padStart(2, '0') + '-' + p[0].padStart(2, '0'); if (d.indexOf('-') !== -1) return d; return ''; }
        function TD_fdo(d) { if (!d) return ''; var p = d.split('-'); if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0]; return d; }
        function TD_ced(rc, dc) { var c = 0; for (var i = 0; i < dc; i++) { if ((rc[i] || '').trim().toLowerCase() === 'đạt') c++; } return c; }
        async function TD_fetchText(urls) {
            var lastErr = new Error('Không tải được dữ liệu');
            for (var i = 0; i < urls.length; i++) {
                try {
                    var res = await fetch(urls[i], { cache: 'no-store' });
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    var text = await res.text();
                    if (text && text.trim()) return text;
                } catch (e) {
                    lastErr = e;
                }
            }
            throw lastErr;
        }

        function TD_ws(data) {
            return fetch(TD_SCR, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            }).then(function(r) { return r.json(); }).then(function(r) {
                if (!r.ok) throw new Error(r.error || 'Lỗi ghi');
                return true;
            }).catch(function() { return false; });
        }

        function createTDPage(cfg) {
            var P = cfg.prefix, pv = cfg.varName;
            var s = { programs: [], adm: false, er: null, dr: null, pd: null, ddOpen: false, inited: false };

            function gid(id) { return document.getElementById(id); }
            
            function ha() {
                ['LoadW', 'ErrW', 'EmptyW', 'Grid'].forEach(function(k) { gid(P + k).style.display = 'none'; });
                gid(P + 'SyncOk').style.display = 'none';
                gid(P + 'SyncErr').style.display = 'none';
            }

            function ca() {
                try { s.adm = sessionStorage.getItem('td_a') === '1'; } catch (e) { s.adm = false; }
                uu();
            }

            function sa(v) {
                s.adm = v;
                try { sessionStorage.setItem('td_a', v ? '1' : '0'); } catch (e) { }
                uu();
            }

            function uu() {
                var a = gid(P + 'AdmBtn');
                if (a) a.classList.toggle('on', s.adm);
                ['DdAdd', 'DdOut', 'DdLock'].forEach(function(id) {
                    var el = gid(P + id);
                    if (el) el.style.display = s.adm ? 'flex' : 'none';
                });
                var sp = gid(P + 'DdSep');
                if (sp) sp.style.display = s.adm ? 'block' : 'none';
                
                var pe = gid(P + 'PopEdt');
                if (pe) pe.style.display = s.adm ? 'flex' : 'none';
                
                gid(P + 'Container').querySelectorAll('.pcard-acts').forEach(function(el) {
                    el.style.display = s.adm ? 'flex' : 'none';
                });
            }

            function na(cb) { s.adm ? cb() : apw(cb); }
            function togDD() {
                if (!s.adm) { na(function() { s.ddOpen = true; gid(P + 'AdmDD').classList.add('show'); }); return; }
                s.ddOpen = !s.ddOpen;
                gid(P + 'AdmDD').classList.toggle('show', s.ddOpen);
            }
            function admAdd() { s.ddOpen = false; gid(P + 'AdmDD').classList.remove('show'); na(oa); }
            function admOut() { s.ddOpen = false; gid(P + 'AdmDD').classList.remove('show'); sa(false); toast('Đã đăng xuất', 'ok'); }
            function admLock() { s.ddOpen = false; gid(P + 'AdmDD').classList.remove('show'); sa(false); toast('Đã khóa', 'ok'); }
            function admReload() { s.ddOpen = false; gid(P + 'AdmDD').classList.remove('show'); lfs(); }

            function apw(cb) {
                s._pcb = cb;
                gid(P + 'PwInp').value = '';
                gid(P + 'PwErr').textContent = '';
                gid(P + 'PwInp').classList.remove('err');
                gid(P + 'PwMdl').classList.add('open');
                document.body.style.overflow = 'hidden';
                setTimeout(function() { gid(P + 'PwInp').focus(); }, 300);
            }
            function cpw() { gid(P + 'PwMdl').classList.remove('open'); document.body.style.overflow = ''; s._pcb = null; }
            function spw() {
                if (gid(P + 'PwInp').value === TD_PW) {
                    sa(true); cpw(); toast('Đăng nhập thành công', 'ok');
                    if (typeof s._pcb === 'function') s._pcb();
                    s._pcb = null;
                } else {
                    gid(P + 'PwInp').classList.add('err');
                    gid(P + 'PwErr').textContent = 'Sai mật khẩu';
                    gid(P + 'PwInp').value = '';
                    setTimeout(function() { gid(P + 'PwInp').focus(); }, 100);
                }
            }

            async function lfs() {
                ha();
                gid(P + 'LoadW').style.display = 'block';
                try {
                    var csv = await TD_fetchText([TD_gdc(), TD_gdcAlt()]);
                    if (!csv || !csv.trim()) throw new Error('Tab trống.');
                    var rows = TD_csv(csv);
                    if (rows.length < 2) throw new Error('Chỉ có tiêu đề.');
                    
                    s.programs = [];
                    for (var i = 1; i < rows.length; i++) {
                        var r = rows[i];
                        if (!r[0] || !r[0].trim()) continue;
                        s.programs.push({
                            row: i + 1,
                            name: (r[0] || '').trim(),
                            posterUrl: (r[1] || '').trim(),
                            sheetName: (r[2] || '').trim(),
                            dateStart: TD_fdi((r[3] || '').trim()),
                            dateEnd: TD_fdi((r[4] || '').trim()),
                            datePH: TD_fdi((r[5] || '').trim()),
                            cols: parseInt(r[6]) || 0,
                            rows: parseInt(r[7]) || 0
                        });
                    }
                    gid(P + 'SyncOk').style.display = 'inline-flex';
                    gid(P + 'SyncErr').style.display = 'none';
                    rc();
                    uu();
                } catch (e) {
                    gid(P + 'ErrMsg').textContent = e.message || 'Lỗi';
                    gid(P + 'ErrW').style.display = 'block';
                    gid(P + 'SyncErr').style.display = 'inline-flex';
                }
                gid(P + 'LoadW').style.display = 'none';
            }

            function rc() {
                var g = gid(P + 'Grid'), ew = gid(P + 'EmptyW');
                var filtered = s.programs.filter(function(p) { return cfg.filterFn(p.name); });
                if (!filtered.length) {
                    ew.style.display = 'block';
                    g.style.display = 'none';
                    gid(P + 'CntB').style.display = 'none';
                    return;
                }
                ew.style.display = 'none';
                g.style.display = 'grid';
                gid(P + 'CntB').style.display = 'inline-flex';
                gid(P + 'CntN').textContent = filtered.length;
                
                var h = '';
                for (var i = 0; i < filtered.length; i++) {
                    var p = filtered[i], hasImg = !!p.posterUrl, dl = i * .06, pidx = s.programs.indexOf(p);
                    h += '<div class="pcard" style="animation-delay:' + dl + 's" onclick="' + pv + '.op(' + pidx + ')">' +
                        '<div class="pcard-badge"><i class="fa-solid ' + cfg.badgeIcon + ' mr-1"></i>' + esc(cfg.badge) + '</div>' +
                        '<div class="pcard-acts" style="display:' + (s.adm ? 'flex' : 'none') + '">' +
                        '<button class="ca-btn edt" onclick="event.stopPropagation();' + pv + '.na(function(){' + pv + '.oe(' + pidx + ')})" aria-label="Sá»­a"><i class="fa-solid fa-pen"></i></button>' +
                        '<button class="ca-btn del" onclick="event.stopPropagation();' + pv + '.na(function(){' + pv + '.ad(' + pidx + ')})" aria-label="Xóa"><i class="fa-solid fa-trash"></i></button>' +
                        '</div>' +
                        (hasImg ? '<div class="pcard-img"><img src="' + esc(p.posterUrl) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=pcard-noimg><i class="fa-regular fa-image></i></div>\'"><div class="pcard-grad"></div></div>' : '<div class="pcard-noimg"><i class="fa-regular fa-image"></i></div>') +
                        '<div class="pcard-body">' +
                        '<div class="pcard-name">' + esc(p.name) + '</div>' +
                        '<div class="pcard-dates">' +
                        '<span class="pcard-d"><i class="fa-solid fa-calendar-days"></i>' + TD_fd(p.dateStart) + ' - ' + TD_fd(p.dateEnd) + '</span>' +
                        '<span class="pcard-d"><i class="fa-solid fa-flag-checkered"></i>PH ' + TD_fd(p.datePH) + '</span>' +
                        '</div>' +
                        '</div>' +
                        '</div>';
                }
                g.innerHTML = h;
            }

            function oa() {
                s.er = null;
                gid(P + 'MTtl').textContent = 'Thêm chương trình';
                gid(P + 'MSub').textContent = 'Ghi lên Google Sheet';
                ['MName', 'MUrl', 'MTab', 'MCols', 'MRows', 'MDS', 'MDE', 'MDPH'].forEach(function(id) { gid(P + id).value = ''; });
                gid(P + 'Mdl').classList.add('open');
                document.body.style.overflow = 'hidden';
            }

            function oe(idx) {
                var p = s.programs[idx];
                if (!p) return;
                s.er = p.row;
                gid(P + 'MTtl').textContent = 'Sửa chương trình';
                gid(P + 'MSub').textContent = 'Cập nhật hàng ' + p.row;
                gid(P + 'MName').value = p.name || '';
                gid(P + 'MUrl').value = p.posterUrl || '';
                gid(P + 'MTab').value = p.sheetName || '';
                gid(P + 'MCols').value = p.cols || '';
                gid(P + 'MRows').value = p.rows || '';
                gid(P + 'MDS').value = p.dateStart || '';
                gid(P + 'MDE').value = p.dateEnd || '';
                gid(P + 'MDPH').value = p.datePH || '';
                gid(P + 'Mdl').classList.add('open');
                document.body.style.overflow = 'hidden';
            }

            function cm() { gid(P + 'Mdl').classList.remove('open'); document.body.style.overflow = ''; s.er = null; }

            async function autoDet() {
                var tab = gid(P + 'MTab').value.trim();
                if (!tab) { toast('Nhập tên sheet trước', 'err'); return; }
                var btn = gid(P + 'AutoBtn');
                btn.classList.add('ld');
                btn.innerHTML = '<i class="fa-solid fa-spinner mr-1"></i>Nhận diện...';
                try {
                    var csv = await TD_fetchText([TD_gtc(tab), TD_gtcAlt(tab)]);
                    var rows = TD_csv(csv);
                    if (!rows.length) throw new Error('Tab trống');
                    gid(P + 'MCols').value = rows[0].length;
                    gid(P + 'MRows').value = Math.max(rows.length - 1, 1);
                    toast(rows[0].length + ' cột, ' + (rows.length - 1) + ' hàng', 'ok');
                } catch (e) { toast(e.message || 'Lỗi', 'err'); }
                finally {
                    btn.classList.remove('ld');
                    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Tự động';
                }
            }

            async function savePrg() {
                var name = gid(P + 'MName').value.trim(),
                    posterUrl = gid(P + 'MUrl').value.trim(),
                    sheetName = gid(P + 'MTab').value.trim(),
                    cols = parseInt(gid(P + 'MCols').value) || 0,
                    rows = parseInt(gid(P + 'MRows').value) || 0,
                    dateS = gid(P + 'MDS').value,
                    dateE = gid(P + 'MDE').value,
                    datePH = gid(P + 'MDPH').value;

                if (!name) { toast('Nhập tên chương trình', 'err'); return; }
                if (!sheetName) { toast('Nhập tên sheet dữ liệu', 'err'); return; }
                if (!dateS || !dateE || !datePH) { toast('Chọn đủ 3 ngày', 'err'); return; }
                if (cols < 1 || cols > 20) { toast('Số cột 1-20', 'err'); return; }
                if (rows < 1 || rows > 500) { toast('Số hàng 1-500', 'err'); return; }

                var data = {
                    ten: name,
                    poster: posterUrl,
                    tab: sheetName,
                    batdau: TD_fdo(dateS),
                    ketthuc: TD_fdo(dateE),
                    chotph: TD_fdo(datePH),
                    cot: cols,
                    hang: rows
                };

                if (s.er) data.action = 'edit', data.row = s.er;
                else data.action = 'add';

                var ok = await TD_ws(data);
                if (ok) {
                    toast(s.er ? 'Đã cập nhật' : 'Đã thêm', 'ok');
                    cm();
                    await lfs();
                }
            }

            function ad(idx) {
                s.dr = s.programs[idx].row;
                gid(P + 'CfmTxt').textContent = '"' + s.programs[idx].name + '" sẽ bị xóa khỏi Sheet.';
                gid(P + 'CfmDel').classList.add('open');
            }

            function ccf() { gid(P + 'CfmDel').classList.remove('open'); s.dr = null; }
            async function ddl() {
                if (!s.dr) return;
                var ok = await TD_ws({ action: 'delete', row: s.dr });
                if (ok) { toast('Đã xóa', 'ok'); ccf(); await lfs(); }
            }

            async function op(idx) {
                var p = s.programs[idx];
                if (!p) return;
                s.pd = p;
                var pw = gid(P + 'PopPoster'), hasImg = !!p.posterUrl;
                pw.innerHTML = '';
                if (hasImg) {
                    var img = document.createElement('img');
                    img.className = 'pop-poster';
                    img.alt = p.name;
                    img.src = p.posterUrl;
                    img.onerror = function() { this.outerHTML = '<div class="pop-ph"><i class="fa-regular fa-image text-3xl" style="opacity:.3"></i></div>'; };
                    pw.appendChild(img);
                } else {
                    pw.innerHTML += '<div class="pop-ph"><i class="fa-regular fa-image text-3xl" style="opacity:.3"></i></div>';
                }
                gid(P + 'PopName').textContent = p.name;
                gid(P + 'PopTag').innerHTML = '<i class="fa-solid ' + cfg.badgeIcon + ' mr-1" style="font-size:7px"></i>' + esc(p.sheetName || '--');
                gid(P + 'PopSub').innerHTML = TD_fd(p.dateStart) + ' - ' + TD_fd(p.dateEnd) + '&nbsp;&nbsp;|&nbsp;&nbsp;PH ' + TD_fd(p.datePH);
                
                var ct = gid(P + 'PopCt');
                // Skeleton Loading for table
                var sc = Math.min(p.cols, 8), sr = Math.min(p.rows, 5);
                var sh = '', sb = '';
                for(var c=0; c<sc; c++) sh += '<th><div class="sk" style="width:'+(55+Math.random()*55)+'px"></div></th>';
                for(var r=0; r<sr; r++) {
                    sb += '<tr>';
                    for(var c2=0; c2<sc; c2++) sb += '<td><div class="sk" style="width:'+(45+Math.random()*60)+'px"></div></td>';
                    sb += '</tr>';
                }
                ct.innerHTML = '<div class="ptw" style="max-height:520px;overflow-y:auto"><table class="pt"><thead><tr>'+sh+'</tr></thead><tbody>'+sb+'</tbody></table></div><div style="display:flex;justify-content:flex-end;margin-top:10px;padding:0 2px"><span style="font-size:.7rem;color:var(--td-fgm)">Cáº­p nháº­t: '+new Date().toLocaleTimeString('vi-VN')+'</span></div>';

                gid(P + 'Popup').classList.add('open');
                document.body.style.overflow = 'hidden';

                // Load real data
                try {
                    var csv = await TD_fetchText([TD_gtc(p.sheetName), TD_gtcAlt(p.sheetName)]);
                    rpt(ct, csv, p.cols, p.rows);
                } catch (err) {
                    ct.innerHTML = '<div style="text-align:center;padding:50px 20px;color:var(--td-fgm)"><i class="fa-solid fa-circle-exclamation block text-3xl mb-3" style="color:var(--td-red)"></i><p class="text-base font-semibold mb-1">Lỗi tải dữ liệu</p><p class="text-sm mb-4">' + esc(err.message || '') + '</p><button onclick="' + pv + '.rpop()" class="bp text-sm"><i class="fa-solid fa-rotate mr-1"></i>Thử lại</button></div>';
                }
            }

            function rpop() { if (!s.pd) return; var idx = s.programs.indexOf(s.pd); if (idx >= 0) op(idx); }
            function cpop() { gid(P + 'Popup').classList.remove('open'); document.body.style.overflow = ''; s.pd = null; }
            function efp() { if (!s.pd) return; var idx = s.programs.indexOf(s.pd); cpop(); na(function() { setTimeout(function() { oe(idx); }, 350); }); }

            function rpt(ct, csv, cols, rows) {
                var all = TD_csv(csv);
                if (!all.length) { ct.innerHTML = '<div style="text-align:center;padding:40px;color:var(--td-fgm)">Tab trống</div>'; return; }
                
                var hd = all[0], data = all.slice(1), dc = Math.min(cols, hd.length), dr = Math.min(rows, data.length);
                var thuongCols = [];
                for (var ci = 0; ci < dc; ci++) {
                    if ((hd[ci] || '').toUpperCase().indexOf('THƯỞNG') !== -1) thuongCols.push(ci);
                }

                var h = '<tr><th>STT</th>';
                for (var i = 0; i < dc; i++) {
                    var isTh = thuongCols.indexOf(i) !== -1;
                    h += '<th style="text-align:center' + (isTh ? ' background:#d4a84314!important;' : '') + '">' + esc(hd[i] || ('Cột ' + (i + 1))) + '</th>';
                }
                h += '</tr>';

                var si = [];
                for (var r = 0; r < dr; r++) si.push(r);
                si.sort(function(a, b) { return TD_ced(data[b] || [], dc) - TD_ced(data[a] || [], dc); });

                var b = '';
                for (var k = 0; k < si.length; k++) {
                    var r = si[k], rc = data[r] || [], dcnt = TD_ced(rc, dc), isDat = dcnt > 0;
                    var hasGlowCode = rc.some(function(v) { return String(v || '').trim() === '10000001111'; });
                    var rowCls = [];
                    if (dcnt > 0) rowCls.push('dat-row');
                    if (hasGlowCode) rowCls.push('glow-row');
                    var cls = rowCls.length ? ' class="' + rowCls.join(' ') + '"' : '';
                    b += '<tr' + cls + ' data-row-index="' + r + '"><td class="pst">' + (r + 1) + '</td>';
                    for (var c = 0; c < dc; c++) {
                        var val = rc[c] || '', isThuong = thuongCols.indexOf(c) !== -1;
                        var cellContent = val.trim().toLowerCase() === 'đạt' ? '<span class="dat-badge">' + esc(val) + '</span>' : esc(val);
                        var style = isThuong ? 'background:#d4a84314!important;font-weight:700;color:#c8960f!important;' : '';
                        var isNumber = /^-?\d+(?:[.,]\d+)?$/.test(String(val).trim());
                        b += '<td class="' + (isNumber ? 'td-num' : 'td-text') + '" style="' + style + '">' + cellContent + '</td>';
                    }
                    b += '</tr>';
                }
                ct.innerHTML = '<div class="ptw" style="max-height:460px;overflow-y:auto"><table class="pt"><thead>' + h + '</thead><tbody>' + b + '</tbody></table></div><div style="display:flex;justify-content:flex-end;margin-top:8px;padding:0 2px"><span style="font-size:.62rem;color:var(--td-fgm)">Cập nhật: ' + new Date().toLocaleTimeString('vi-VN') + '</span></div>';
                ct.querySelectorAll('tbody tr').forEach(function(row) {
                    row.addEventListener('click', function() {
                        ct.querySelectorAll('tbody tr.is-focus').forEach(function(activeRow) {
                            activeRow.classList.remove('is-focus');
                        });
                        row.classList.add('is-focus');
                    });
                });
            }

            function buildHTML() {
                return '<div class="td-bg-a"></div><div class="tw" id="' + P + 'Tw"></div>' +
                    '<nav class="td-topnav"><div class="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">' +
                    '<div class="flex items-center gap-3">' +
                    '<button class="admin-btn" onclick="go(\'view-main\')" aria-label="Quay láº¡i"><i class="fa-solid fa-arrow-left"></i></button>' +
                    '<span class="td-sub-title">' + esc(cfg.title) + '</span></div>' +
                    '<div class="flex items-center gap-3">' +
                    '<span class="sync-badge" id="' + P + 'SyncOk" style="display:none"><i class="fa-solid fa-cloud"></i>Đã đồng bộ</span>' +
                    '<span class="err-badge" id="' + P + 'SyncErr" style="display:none"><i class="fa-solid fa-cloud-xmark"></i>Lỗi</span>' +
                    '<span class="text-xs px-2.5 py-1 rounded-full border items-center gap-1" style="border-color:var(--td-border);color:var(--td-fgm);display:none" id="' + P + 'CntB"><i class="fa-solid fa-layer-group" style="font-size:9px"></i><span id="' + P + 'CntN">0</span></span>' +
                    '<div style="position:relative" id="' + P + 'AdmWrap">' +
                    '<button class="admin-btn" id="' + P + 'AdmBtn" onclick="' + pv + '.togDD()" aria-label="Quản trị"><i class="fa-solid fa-user-shield"></i></button>' +
                    '<div class="admin-dd" id="' + P + 'AdmDD">' +
                    '<button class="dd-item" onclick="' + pv + '.admAdd()" id="' + P + 'DdAdd" style="display:none"><i class="fa-solid fa-plus"></i>Thêm chương trình</button>' +
                    '<button class="dd-item" onclick="' + pv + '.admReload()"><i class="fa-solid fa-arrows-rotate"></i>Đồng bộ ngay</button>' +
                    '<button class="dd-item" onclick="' + pv + '.admOut()" id="' + P + 'DdOut" style="display:none"><i class="fa-solid fa-right-from-bracket"></i>Đăng xuất</button>' +
                    '<div class="dd-sep" id="' + P + 'DdSep" style="display:none"></div>' +
                    '<button class="dd-item dng" onclick="' + pv + '.admLock()" id="' + P + 'DdLock" style="display:none"><i class="fa-solid fa-lock"></i>Khóa quản trị</button>' +
                    '</div></div></div></div></nav>' +
                    '<div class="td-sub-line-wrap"><div class="td-sub-line"></div></div>' +
                    '<div id="' + P + 'Container" class="relative z-10">' +
                    '<div class="td-shell">' +
                    '<div id="' + P + 'LoadW" style="display:none"><div class="loading-g"><i class="fa-solid fa-cloud-arrow-down block"></i><p class="text-base font-semibold mb-1">Đang đồng bộ...</p></div></div>' +
                    '<div id="' + P + 'ErrW" style="display:none"><div class="err-g"><i class="fa-solid fa-circle-exclamation block"></i><p class="text-base font-semibold mb-1" style="color:var(--td-fg)">Lỗi kết nối</p><p class="text-sm" id="' + P + 'ErrMsg" style="color:var(--td-fgm)"></p></div></div>' +
                    '<div id="' + P + 'EmptyW"><div class="empty-g"><i class="fa-regular fa-folder-open block"></i><p class="text-base font-semibold mb-1">' + esc(cfg.emptyTitle) + '</p><p class="text-sm" style="color:var(--td-fgm)">' + esc(cfg.emptyDesc) + '</p></div></div>' +
                    '<div class="card-grid" id="' + P + 'Grid" style="display:none"></div>' +
                    '</div></div>' +
                    '<div class="pop-bg" id="' + P + 'Popup"><div class="pop-box"><div id="' + P + 'PopPoster" style="position:relative"></div><div class="pop-bar"><button type="button" onclick="' + pv + '.cpop()" class="pop-back" style="position:static;flex-shrink:0" aria-label="Trở về"><i class="fa-solid fa-arrow-left"></i></button><div style="flex:1;min-width:0"><h2 class="fd text-xl font-bold" id="' + P + 'PopName"></h2><div class="flex items-center gap-3 mt-1.5 flex-wrap"><span class="tag" id="' + P + 'PopTag"></span><p class="text-xs" style="color:var(--td-fgm)" id="' + P + 'PopSub"></p></div></div><div class="flex gap-2 mt-1 shrink-0"><button onclick="' + pv + '.efp()" class="ca-btn edt" style="opacity:1;position:static;display:none" id="' + P + 'PopEdt" aria-label="Sửa"><i class="fa-solid fa-pen"></i></button></div></div><div class="pop-ct" id="' + P + 'PopCt"></div></div></div>' +
                    '<div class="pw-bg" id="' + P + 'PwMdl"><div class="pw-box"><div class="pw-ico"><i class="fa-solid fa-shield-halved"></i></div><h3 class="fd text-lg font-bold mb-1">Quản trị viên</h3><p class="text-xs mb-5" style="color:var(--td-fgm)">Nhập mật khẩu để tiếp tục</p><input type="password" class="pw-inp" id="' + P + 'PwInp" placeholder="Mật khẩu" autocomplete="off"><p class="pw-err" id="' + P + 'PwErr"></p><button onclick="' + pv + '.spw()" class="bp" style="width:100%;margin-top:16px"><i class="fa-solid fa-unlock mr-2"></i>Xác nhận</button><button onclick="' + pv + '.cpw()" class="bs" style="width:100%;margin-top:8px">Huỷ</button></div></div>' +
                    '<div class="mdl-bg" id="' + P + 'Mdl"><div class="mdl-box"><div class="flex items-center justify-between mb-5"><div><h3 class="fd text-lg font-bold" id="' + P + 'MTtl">Thêm chương trình</h3><p class="text-xs mt-0.5" style="color:var(--td-fgm)" id="' + P + 'MSub"></p></div><button onclick="' + pv + '.cm()" class="w-8 h-8 rounded-lg flex items-center justify-content:center" style="color:var(--td-fgm);background:none;border:none;cursor:pointer" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button></div><div class="space-y-4"><div><label class="fl"><i class="fa-solid fa-pen"></i>Tên chương trình <span class="rq">*</span></label><input type="text" class="inp" id="' + P + 'MName" placeholder="VD: Thi đua Quyết thắng 2025"></div><div><label class="fl"><i class="fa-solid fa-link"></i>URL ảnh poster</label><input type="url" class="inp" id="' + P + 'MUrl" placeholder="https://example.com/poster.jpg"></div><hr style="border-color:var(--td-border)"><div><label class="fl"><i class="fa-solid fa-layer-group"></i>Tên sheet dữ liệu (tab) <span class="rq">*</span></label><input type="text" class="inp" id="' + P + 'MTab" placeholder="VD: Quyết thắng"></div><div><label class="fl"><i class="fa-regular fa-calendar"></i>Bắt đầu <span class="rq">*</span></label><input type="date" class="inp" id="' + P + 'MDS"></div><div><label class="fl"><i class="fa-regular fa-calendar-check"></i>Kết thúc PH <span class="rq">*</span></label><input type="date" class="inp" id="' + P + 'MDE"></div><div><label class="fl"><i class="fa-solid fa-flag-checkered"></i>Chốt PH <span class="rq">*</span></label><input type="date" class="inp" id="' + P + 'MDPH"></div><hr style="border-color:var(--td-border)"><div><div class="flex items-center justify-between mb-2"><label class="fl mb-0"><i class="fa-solid fa-table-columns"></i>Số cột & hàng</label><button type="button" class="abtn" id="' + P + 'AutoBtn" onclick="' + pv + '.autoDet()"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Tự động</button></div><div class="grid grid-cols-2 gap-3"><div><input type="number" class="inp" id="' + P + 'MCols" placeholder="Cột" min="1" max="20"></div><div><input type="number" class="inp" id="' + P + 'MRows" placeholder="Hàng" min="1" max="500"></div></div></div></div><div class="flex gap-3 mt-6"><button onclick="' + pv + '.savePrg()" class="bp flex-1"><i class="fa-solid fa-check mr-2"></i>Lưu lên Sheet</button><button onclick="' + pv + '.cm()" class="bs">Huỷ</button></div></div></div>' +
                    '<div class="cfm-bg" id="' + P + 'CfmDel"><div class="cfm-box"><i class="fa-solid fa-triangle-exclamation text-3xl mb-3" style="color:var(--td-red)"></i><p class="text-base font-semibold mb-1">Xóa chương trình?</p><p class="text-sm mb-5" style="color:var(--td-fgm)" id="' + P + 'CfmTxt"></p></div><div class="flex gap-3 justify-center"><button onclick="' + pv + '.ddl()" class="bp text-sm px-5" style="background:linear-gradient(135deg,var(--td-red),#8a2a22);border-radius:8px"><i class="fa-solid fa-trash mr-1"></i>Xóa</button><button onclick="' + pv + '.ccf()" class="bs text-sm px-5">Huỷ</button></div></div></div>';
            }

            function init() {
                var container = gid(cfg.containerId);
                if (!s.inited) {
                    container.innerHTML = buildHTML();
                    gid(P + 'PwInp').addEventListener('keydown', function(e) { if (e.key === 'Enter') spw(); });
                    gid(P + 'Mdl').addEventListener('click', function(e) { if (e.target === e.currentTarget) cm(); });
                    gid(P + 'Popup').addEventListener('click', function(e) { if (e.target === e.currentTarget) cpop(); });
                    document.addEventListener('click', function(e) {
                        if (gid(P + 'AdmWrap') && !gid(P + 'AdmWrap').contains(e.target)) {
                            s.ddOpen = false;
                            gid(P + 'AdmDD').classList.remove('show');
                        }
                    });
                    s.inited = true;
                }
                ca();
                lfs();
            }

            return {
                gid: gid, init: init, togDD: togDD, admAdd: admAdd, admReload: admReload, admOut: admOut, admLock: admLock, na: na, spw: spw, cpw: cpw, cpop: cpop, rpop: rpop, efp: efp, cm: cm, autoDet: autoDet, savePrg: savePrg, ad: ad, ccf: ccf, ddl: ddl, oe: oe, op: op
            };
        }

        // Initialize Race and Policy Pages
        var tdPage = createTDPage({
            prefix: 'td', varName: 'tdPage', containerId: 'view-race', title: 'Tiến Độ Thi Đua', badge: 'Thi đua', badgeIcon: 'fa-trophy', emptyTitle: 'Chưa có chương trình thi đua', emptyDesc: 'Nhấn icon <i class="fa-solid fa-user-shield" style="color:var(--td-accent)"></i> để quản trị.', filterFn: function(n) { return /^thi\s*đua/i.test(n); }
        });
        
        var poPage = createTDPage({
            prefix: 'po', varName: 'poPage', containerId: 'view-policy', title: 'Chính Sách', badge: 'Chính sách', badgeIcon: 'fa-book', emptyTitle: 'Chưa có chính sách nào', emptyDesc: 'Nhấn icon <i class="fa-solid fa-user-shield" style="color:var(--td-accent)"></i> để quản trị.', filterFn: function(n) { return /^chính\s*sách/i.test(n); }
        });

        // Global Keydown listener for Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                [tdPage, poPage].forEach(function(pg) {
                    if (!pg) return;
                    ['PwMdl', 'CfmDel', 'Mdl', 'Popup'].forEach(function(s) {
                        var el = pg.gid(s);
                        if (el && el.classList.contains('open')) {
                            if (s === 'PwMdl') pg.cpw();
                            else if (s === 'CfmDel') pg.ccf();
                            else if (s === 'Popup') pg.cpop();
                            else if (s === 'Mdl') pg.cm();
                        }
                    });
                });
            }
        });

        // Start App
        syncData();
