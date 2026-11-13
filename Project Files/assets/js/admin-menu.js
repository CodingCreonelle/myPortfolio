/* =========================================================================
   Hidden Admin Studio (Brand Icon Press-and-Hold).

   Unlocks by pressing and holding the navbar brand icon (.brand / .brand-icon)
   for HOLD_DURATION_MS (650ms). Provides a full, scalable studio for adding,
   editing, reordering, and removing Projects, Documentation sections, Skills &
   Tools, Timeline & Trainings, Page Copy / Lists, Social links, and JSON
   snapshots—backed by PortfolioUtils localStorage overrides with live DOM
   re-hydration across every page.
   ========================================================================= */
(function (global) {
    'use strict';

    var HOLD_DURATION_MS = 650;
    var DIALOG_ID = 'portfolio-admin-dialog';
    var AUTH_DIALOG_ID = 'portfolio-admin-auth-dialog';
    var AUTH_STORAGE_KEY = 'portfolio_admin_auth_v1';
    var DEFAULT_AUTH_SALT = 'ef92b778bafe771e89245b89ecbc08a4';
    var DEFAULT_AUTH_HASH = '47ac3c8fd57bcc2d4b11c0f05f2b8f8f00c5157534f5e40b5bed28071f39bae5';
    var AUTH_ROUNDS = 2048;
    var CORE_SOCIAL_KEYS = ['email', 'github', 'linkedin', 'discord'];
    var TABS = [
        { key: 'projects', label: 'Projects' },
        { key: 'documentation', label: 'Documentation' },
        { key: 'skills', label: 'Skills & Tools' },
        { key: 'timeline', label: 'Timeline & Trainings' },
        { key: 'pages', label: 'Pages & Socials' }
    ];

    var state = {
        loaded: false,
        authenticated: false,
        passwordDrawerOpen: false,
        pendingTab: null,
        activeTab: 'projects',
        selectedProjectIndex: 0,
        selectedDocProjectId: '',
        statusMessage: '',
        data: {
            projects: [],
            experience: { languages: [], tools: [], timeline: [] },
            pages: {},
            socials: {}
        }
    };

    var gesture = {
        timer: null,
        suppressClickTimer: null,
        suppressNextBrandClick: false,
        holdingBrand: null,
        pointerId: null,
        startX: 0,
        startY: 0,
        initialized: false
    };

    /* ------------------------------------------------------------- Helpers */
    function utils() {
        return global.PortfolioUtils || null;
    }

    function esc(value) {
        var u = utils();
        if (u && typeof u.escapeHtml === 'function') {
            return u.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function clone(value) {
        if (value === null || value === undefined) return value;
        return JSON.parse(JSON.stringify(value));
    }

    function siteRoot() {
        var u = utils();
        if (u && typeof u.getSiteRoot === 'function') {
            return u.getSiteRoot();
        }
        return '';
    }

    function slugify(value, fallback) {
        var s = String(value || '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return s || fallback || 'item';
    }

    function parseCommaList(str) {
        return String(str || '')
            .split(',')
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
    }

    function parseLineList(str) {
        return String(str || '')
            .split(/\r?\n/)
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
    }

    function formatMetricsText(metrics) {
        if (!Array.isArray(metrics)) return '';
        return metrics.map(function (m) {
            return (m && m.label ? m.label : '') + ' | ' + (m && m.value ? m.value : '');
        }).join('\n');
    }

    function parseMetricsText(str) {
        return parseLineList(str).map(function (line) {
            var parts = line.split('|');
            return {
                label: (parts[0] || '').trim(),
                value: parts.slice(1).join('|').trim()
            };
        }).filter(function (m) { return m.label || m.value; });
    }

    function arrayMove(arr, index, delta) {
        if (!Array.isArray(arr)) return;
        var next = index + delta;
        if (index < 0 || index >= arr.length || next < 0 || next >= arr.length) return;
        var item = arr.splice(index, 1)[0];
        arr.splice(next, 0, item);
    }

    function fetchDataset(name, options) {
        var u = utils();
        var url = siteRoot() + 'data/' + name + '.json';
        if (u && typeof u.fetchJSON === 'function') {
            return u.fetchJSON(url, options);
        }
        return fetch(url).then(function (r) {
            return r.ok ? r.json() : null;
        }).catch(function () { return null; });
    }

    var diskSync = {
        dirHandle: null
    };

    /* ------------------------------------------------------------- Auth & KDF */
    function sha256Hex(ascii) {
        function rightRotate(value, amount) {
            return (value >>> amount) | (value << (32 - amount));
        }
        var mathPow = Math.pow;
        var maxWord = mathPow(2, 32);
        var i, j;
        var result = '';
        var words = [];
        var asciiBitLength = ascii.length * 8;
        var hash = [];
        var k = [];
        var primeCounter = 0;
        var isComposite = {};

        for (var candidate = 2; primeCounter < 64; candidate++) {
            if (!isComposite[candidate]) {
                for (i = 0; i < 313; i += candidate) {
                    isComposite[i] = candidate;
                }
                hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
                k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
            }
        }

        ascii += '\x80';
        while (ascii.length % 64 - 56) ascii += '\x00';
        for (i = 0; i < ascii.length; i++) {
            j = ascii.charCodeAt(i);
            words[i >> 2] |= j << ((3 - i) % 4) * 8;
        }
        words[words.length] = (asciiBitLength / maxWord) | 0;
        words[words.length] = asciiBitLength;

        for (j = 0; j < words.length;) {
            var w = words.slice(j, j += 16);
            var oldHash = hash;
            hash = hash.slice(0, 8);
            for (i = 0; i < 64; i++) {
                var w15 = w[i - 15];
                var w2 = w[i - 2];
                var a = hash[0];
                var e = hash[4];
                var temp1 = hash[7] +
                    (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
                    ((e & hash[5]) ^ ((~e) & hash[6])) +
                    k[i] +
                    (w[i] = (i < 16) ? w[i] : (
                        w[i - 16] +
                        (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                        w[i - 7] +
                        (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
                    ) | 0);
                var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
                    ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
                hash = [(temp1 + temp2) | 0].concat(hash);
                hash[4] = (hash[4] + temp1) | 0;
            }
            for (i = 0; i < 8; i++) {
                hash[i] = (hash[i] + oldHash[i]) | 0;
            }
        }

        for (i = 0; i < 8; i++) {
            for (j = 3; j + 1; j--) {
                var b = (hash[i] >> (j * 8)) & 255;
                result += ((b < 16) ? '0' : '') + b.toString(16);
            }
        }
        return result;
    }

    function utf8Bytes(str) {
        if (typeof TextEncoder !== 'undefined') {
            var bytes = new TextEncoder().encode(String(str));
            var out = '';
            for (var i = 0; i < bytes.length; i++) {
                out += String.fromCharCode(bytes[i]);
            }
            return out;
        }
        return unescape(encodeURIComponent(String(str)));
    }

    function derivePasswordHash(password, salt) {
        var h = sha256Hex(utf8Bytes(salt + ':' + String(password)));
        for (var i = 1; i < AUTH_ROUNDS; i++) {
            h = sha256Hex(utf8Bytes(h + ':' + salt + ':' + i));
        }
        return h;
    }

    function constantTimeEqual(a, b) {
        if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
        var diff = 0;
        for (var i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return diff === 0;
    }

    function generateSaltHex() {
        var out = '';
        if (typeof global !== 'undefined' && global.crypto && typeof global.crypto.getRandomValues === 'function') {
            var arr = new Uint8Array(16);
            global.crypto.getRandomValues(arr);
            for (var i = 0; i < arr.length; i++) {
                out += ('0' + arr[i].toString(16)).slice(-2);
            }
            return out;
        }
        for (var j = 0; j < 32; j++) {
            out += Math.floor(Math.random() * 16).toString(16);
        }
        return out;
    }

    function readStoredAuthVerifier() {
        try {
            if (typeof global === 'undefined' || !global.localStorage) return null;
            var raw = global.localStorage.getItem(AUTH_STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (parsed && /^[0-9a-f]{16,64}$/.test(parsed.salt) && /^[0-9a-f]{64}$/.test(parsed.hash)) {
                return { salt: parsed.salt, hash: parsed.hash };
            }
        } catch (_e) {}
        return null;
    }

    function getAuthVerifier() {
        return readStoredAuthVerifier() || { salt: DEFAULT_AUTH_SALT, hash: DEFAULT_AUTH_HASH };
    }

    function isAuthenticated() {
        return Boolean(state.authenticated);
    }

    function verifyPassword(password) {
        var verifier = getAuthVerifier();
        var candidate = derivePasswordHash(String(password == null ? '' : password), verifier.salt);
        var match = constantTimeEqual(candidate, verifier.hash);
        if (match) {
            state.authenticated = true;
        }
        return match;
    }

    function saveAuthToServer(salt, hash) {
        var fetchFn = (typeof global !== 'undefined' && typeof global.fetch === 'function')
            ? global.fetch
            : (typeof fetch === 'function' ? fetch : null);
        if (!fetchFn) return Promise.resolve({ ok: false, reason: 'no-fetch' });

        var url = siteRoot() + 'api/admin/auth';
        return fetchFn(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salt: salt, hash: hash })
        })
            .then(function (res) {
                if (!res || !res.ok) return { ok: false, status: res ? res.status : 0 };
                return res.json().catch(function () { return { ok: true }; });
            })
            .catch(function (err) {
                return { ok: false, error: err && err.message ? err.message : 'network-error' };
            });
    }

    function changePassword(currentPassword, newPassword) {
        if (!verifyPassword(currentPassword)) {
            return { ok: false, error: 'Current password is incorrect.' };
        }
        var nextPw = String(newPassword == null ? '' : newPassword);
        if (nextPw.length < 4) {
            return { ok: false, error: 'New password must be at least 4 characters.' };
        }

        var newSalt = generateSaltHex();
        var newHash = derivePasswordHash(nextPw, newSalt);
        DEFAULT_AUTH_SALT = newSalt;
        DEFAULT_AUTH_HASH = newHash;

        try {
            if (typeof global !== 'undefined' && global.localStorage) {
                global.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ salt: newSalt, hash: newHash }));
            }
        } catch (_e) {}

        var persistPromise = saveAuthToServer(newSalt, newHash).then(function (res) {
            if (res && res.ok) {
                setStatus('Admin password updated and saved directly to codebase.');
            }
            return res;
        });

        setStatus('Admin password updated.');
        return { ok: true, salt: newSalt, hash: newHash, persisted: persistPromise };
    }

    function resetPasswordVerifier() {
        try {
            if (typeof global !== 'undefined' && global.localStorage) {
                global.localStorage.removeItem(AUTH_STORAGE_KEY);
            }
        } catch (_e) {}
    }

    function clearShadowOverride(dataset) {
        var u = utils();
        if (u && typeof u.clearAdminOverride === 'function') {
            u.clearAdminOverride(dataset);
        }
    }

    function saveDatasetToServer(dataset, snapshot) {
        var fetchFn = (typeof global !== 'undefined' && typeof global.fetch === 'function')
            ? global.fetch
            : (typeof fetch === 'function' ? fetch : null);
        if (!fetchFn) return Promise.resolve({ ok: false, reason: 'no-fetch' });

        var url = siteRoot() + 'api/admin/data/' + encodeURIComponent(dataset);
        return fetchFn(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ __adminPayload: snapshot })
        })
            .then(function (res) {
                if (!res || !res.ok) return { ok: false, status: res ? res.status : 0 };
                return res.json().catch(function () { return { ok: true, dataset: dataset }; });
            })
            .catch(function (err) {
                return { ok: false, error: err && err.message ? err.message : 'network-error' };
            });
    }

    function resolveDataFileHandle(rootHandle, dataset) {
        if (!rootHandle || typeof rootHandle.getDirectoryHandle !== 'function') {
            return Promise.resolve(null);
        }
        var fileName = dataset + '.json';
        return rootHandle.getDirectoryHandle('Project Files')
            .then(function (pf) { return pf.getDirectoryHandle('data'); })
            .then(function (dataDir) { return dataDir.getFileHandle(fileName, { create: true }); })
            .catch(function () {
                return rootHandle.getDirectoryHandle('data')
                    .then(function (dataDir) { return dataDir.getFileHandle(fileName, { create: true }); })
                    .catch(function () {
                        return rootHandle.getFileHandle(fileName, { create: true }).catch(function () { return null; });
                    });
            });
    }

    function saveDatasetToDirectoryHandle(dataset, snapshot) {
        if (!diskSync.dirHandle) return Promise.resolve({ ok: false, reason: 'no-dir-handle' });
        return resolveDataFileHandle(diskSync.dirHandle, dataset).then(function (fileHandle) {
            if (!fileHandle || typeof fileHandle.createWritable !== 'function') {
                return { ok: false, reason: 'no-file-handle' };
            }
            return fileHandle.createWritable().then(function (writable) {
                var formatted = JSON.stringify(snapshot, null, 2) + '\n';
                return writable.write(formatted).then(function () {
                    return writable.close();
                });
            }).then(function () {
                return { ok: true, dataset: dataset, file: 'Project Files/data/' + dataset + '.json', via: 'fs-access' };
            });
        }).catch(function (err) {
            return { ok: false, error: err && err.message ? err.message : 'fs-write-failed' };
        });
    }

    function saveDatasetToDisk(dataset, snapshot) {
        var payload = snapshot !== undefined ? snapshot : clone(state.data[dataset]);
        return saveDatasetToServer(dataset, payload).then(function (res) {
            if (res && res.ok) return res;
            return saveDatasetToDirectoryHandle(dataset, payload);
        }).then(function (res) {
            if (res && res.ok) {
                clearShadowOverride(dataset);
                setStatus('Saved directly to Project Files/data/' + dataset + '.json.');
                updateTabCounts(getDialog());
                return res;
            }
            return res || { ok: false };
        });
    }

    function linkProjectDirectory() {
        if (typeof global === 'undefined' || typeof global.showDirectoryPicker !== 'function') {
            setStatus('Directory linking is unavailable in this browser; run via server.js for direct writes.');
            return Promise.resolve(false);
        }
        return global.showDirectoryPicker({ mode: 'readwrite' }).then(function (handle) {
            diskSync.dirHandle = handle;
            setStatus('Linked local project folder for direct code saves.');
            return syncAllToDisk();
        }).catch(function () {
            return false;
        });
    }

    function syncAllToDisk() {
        ensureLoadedSyncFallback();
        var datasets = ['projects', 'experience', 'pages', 'socials'];
        return Promise.all(datasets.map(function (ds) {
            return saveDatasetToDisk(ds, clone(state.data[ds]));
        })).then(function (results) {
            var written = results.filter(function (r) { return r && r.ok; }).length;
            if (written === datasets.length) {
                setStatus('Wrote all ' + written + ' data files directly to codebase.');
            } else if (written > 0) {
                setStatus('Wrote ' + written + ' of ' + datasets.length + ' files to codebase.');
            } else {
                setStatus('Saved in browser cache. Run `npm start` or link project folder to write directly to disk.');
            }
            updateTabCounts(getDialog());
            renderDialogBody();
            return results;
        });
    }

    function persistDataset(dataset, value, notice) {
        var u = utils();
        var snapshot = clone(value);
        state.data[dataset] = snapshot;
        if (u && typeof u.setAdminOverride === 'function') {
            u.setAdminOverride(dataset, snapshot);
        }
        if (notice) {
            setStatus(notice);
        }
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
            saveDatasetToDisk(dataset, snapshot);
        }
        return snapshot;
    }

    function setStatus(message) {
        state.statusMessage = String(message || '');
        var dialog = getDialog();
        if (!dialog) return;
        var statusEl = dialog.querySelector('[data-admin-status]');
        if (statusEl) {
            statusEl.textContent = state.statusMessage;
        }
    }

    /* ------------------------------------------------------------- Data Loading */
    function normalizeExperience(exp) {
        var obj = (exp && typeof exp === 'object' && !Array.isArray(exp)) ? clone(exp) : {};
        if (!Array.isArray(obj.languages)) obj.languages = [];
        if (!Array.isArray(obj.tools)) obj.tools = [];
        if (!Array.isArray(obj.timeline)) obj.timeline = [];
        if (!Array.isArray(obj.projectSortOptions)) obj.projectSortOptions = [];
        return obj;
    }

    function loadAllData(forceReload) {
        if (state.loaded && !forceReload) {
            return Promise.resolve(clone(state.data));
        }
        return Promise.all([
            fetchDataset('projects'),
            fetchDataset('experience'),
            fetchDataset('pages'),
            fetchDataset('socials')
        ]).then(function (results) {
            state.data.projects = Array.isArray(results[0]) ? clone(results[0]) : [];
            state.data.experience = normalizeExperience(results[1]);
            state.data.pages = (results[2] && typeof results[2] === 'object') ? clone(results[2]) : {};
            state.data.socials = (results[3] && typeof results[3] === 'object') ? clone(results[3]) : {};
            state.loaded = true;

            if (state.selectedProjectIndex >= state.data.projects.length) {
                state.selectedProjectIndex = Math.max(0, state.data.projects.length - 1);
            }
            if (!state.selectedDocProjectId && state.data.projects.length > 0) {
                state.selectedDocProjectId = String(state.data.projects[0].id);
            }
            return clone(state.data);
        });
    }

    /* ------------------------------------------------------------- Programmatic CRUD API */
    function ensureLoadedSyncFallback() {
        var u = utils();
        if (!u || typeof u.getAdminOverride !== 'function') return;
        var p = u.getAdminOverride('projects');
        var e = u.getAdminOverride('experience');
        var pg = u.getAdminOverride('pages');
        var s = u.getAdminOverride('socials');
        if (Array.isArray(p)) state.data.projects = p;
        if (e && typeof e === 'object') state.data.experience = normalizeExperience(e);
        if (pg && typeof pg === 'object') state.data.pages = pg;
        if (s && typeof s === 'object') state.data.socials = s;
    }

    function addProject(projectInput) {
        ensureLoadedSyncFallback();
        var list = Array.isArray(state.data.projects) ? state.data.projects.slice() : [];
        var nextNum = list.length + 1;
        var input = projectInput && typeof projectInput === 'object' ? clone(projectInput) : {};
        var title = String(input.title || ('New Project ' + nextNum)).trim();
        var id = String(input.id || slugify(title, 'project-' + nextNum));

        while (list.some(function (p) { return String(p.id) === id; })) {
            nextNum += 1;
            id = slugify(title, 'project') + '-' + nextNum;
        }

        var created = Object.assign({
            id: id,
            title: title,
            status: 'In Progress',
            featured: false,
            summary: 'Short project overview shown on archive cards.',
            description: 'Detailed architecture and implementation overview.',
            image: '',
            imageAlt: title + ' preview',
            tech: ['JavaScript'],
            tags: ['JavaScript'],
            highlights: [],
            metrics: [],
            links: { github: '', repo: '', live: '', docs: 'docs/doc.html?id=' + encodeURIComponent(id) },
            demo: { url: '', instructions: '' },
            documentation: [
                { heading: 'Overview', body: 'Architecture and setup notes for ' + title + '.' }
            ]
        }, input, { id: id, title: title });

        list.push(created);
        state.selectedProjectIndex = list.length - 1;
        state.selectedDocProjectId = id;
        persistDataset('projects', list, 'Added project "' + title + '".');
        renderDialogBody();
        return clone(created);
    }

    function updateProject(index, patch) {
        ensureLoadedSyncFallback();
        var list = state.data.projects.slice();
        if (index < 0 || index >= list.length) return null;
        var updated = Object.assign({}, list[index], clone(patch));
        list[index] = updated;
        persistDataset('projects', list, 'Saved changes to "' + (updated.title || updated.id) + '".');
        renderDialogBody();
        return clone(updated);
    }

    function removeProject(idOrIndex) {
        ensureLoadedSyncFallback();
        var list = state.data.projects.slice();
        var idx = typeof idOrIndex === 'number'
            ? idOrIndex
            : list.findIndex(function (p) { return String(p.id) === String(idOrIndex); });
        if (idx < 0 || idx >= list.length) return false;
        var removed = list.splice(idx, 1)[0];
        if (state.selectedProjectIndex >= list.length) {
            state.selectedProjectIndex = Math.max(0, list.length - 1);
        }
        if (String(state.selectedDocProjectId) === String(removed.id)) {
            state.selectedDocProjectId = list.length ? String(list[0].id) : '';
        }
        persistDataset('projects', list, 'Removed project "' + (removed.title || removed.id) + '".');
        renderDialogBody();
        return true;
    }

    function moveProject(index, delta) {
        ensureLoadedSyncFallback();
        var list = state.data.projects.slice();
        var target = index + delta;
        if (index < 0 || index >= list.length || target < 0 || target >= list.length) return;
        arrayMove(list, index, delta);
        state.selectedProjectIndex = target;
        persistDataset('projects', list, 'Reordered projects.');
        renderDialogBody();
    }

    function saveDocumentation(projectId, sections) {
        ensureLoadedSyncFallback();
        var list = state.data.projects.slice();
        var idx = list.findIndex(function (p) { return String(p.id) === String(projectId); });
        if (idx === -1) return null;
        var proj = clone(list[idx]);
        proj.documentation = Array.isArray(sections) ? clone(sections) : [];
        list[idx] = proj;
        persistDataset('projects', list, 'Updated documentation for "' + (proj.title || proj.id) + '".');
        renderDialogBody();
        return clone(proj.documentation);
    }

    function addLanguage(langInput) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        var item = Object.assign({
            name: 'New Skill',
            icon: 'code',
            level: 'Working knowledge'
        }, clone(langInput || {}));
        exp.languages.push(item);
        persistDataset('experience', exp, 'Added skill "' + item.name + '".');
        renderDialogBody();
        return clone(item);
    }

    function removeLanguage(index) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        if (index < 0 || index >= exp.languages.length) return false;
        var removed = exp.languages.splice(index, 1)[0];
        persistDataset('experience', exp, 'Removed skill "' + (removed.name || index) + '".');
        renderDialogBody();
        return true;
    }

    function addSortOption(optionInput) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        var nextNum = exp.projectSortOptions.length + 1;
        var input = optionInput && typeof optionInput === 'object' ? clone(optionInput) : {};
        var label = String(input.label || ('Custom Sort ' + nextNum)).trim();
        var id = String(input.id || slugify(label, 'sort-' + nextNum));
        while (exp.projectSortOptions.some(function (opt) { return String(opt.id) === id; })) {
            nextNum += 1;
            id = slugify(label, 'sort') + '-' + nextNum;
        }
        var created = Object.assign({
            id: id,
            label: label,
            by: 'language',
            target: ''
        }, input, { id: id, label: label });
        exp.projectSortOptions.push(created);
        persistDataset('experience', exp, 'Added custom sort option "' + label + '".');
        renderDialogBody();
        return clone(created);
    }

    function updateSortOption(index, patch) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        if (index < 0 || index >= exp.projectSortOptions.length) return null;
        var updated = Object.assign({}, exp.projectSortOptions[index], clone(patch || {}));
        if (!updated.id) updated.id = slugify(updated.label, 'sort-' + (index + 1));
        exp.projectSortOptions[index] = updated;
        persistDataset('experience', exp, 'Saved custom sort option "' + (updated.label || updated.id) + '".');
        renderDialogBody();
        return clone(updated);
    }

    function removeSortOption(idOrIndex) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        var idx = typeof idOrIndex === 'number'
            ? idOrIndex
            : exp.projectSortOptions.findIndex(function (opt) { return String(opt.id) === String(idOrIndex); });
        if (idx < 0 || idx >= exp.projectSortOptions.length) return false;
        var removed = exp.projectSortOptions.splice(idx, 1)[0];
        persistDataset('experience', exp, 'Removed custom sort option "' + (removed.label || removed.id) + '".');
        renderDialogBody();
        return true;
    }

    function moveSortOption(index, delta) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        var target = index + delta;
        if (index < 0 || index >= exp.projectSortOptions.length || target < 0 || target >= exp.projectSortOptions.length) return;
        arrayMove(exp.projectSortOptions, index, delta);
        persistDataset('experience', exp, 'Reordered custom sort options.');
        renderDialogBody();
    }

    function addTool(toolInput) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        var item = Object.assign({
            name: 'New Tool',
            icon: 'vscode',
            level: 'Core',
            summary: 'Workflow tool',
            description: 'Describe how you use this tool.'
        }, clone(toolInput || {}));
        exp.tools.push(item);
        persistDataset('experience', exp, 'Added tool "' + item.name + '".');
        renderDialogBody();
        return clone(item);
    }

    function removeTool(index) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        if (index < 0 || index >= exp.tools.length) return false;
        var removed = exp.tools.splice(index, 1)[0];
        persistDataset('experience', exp, 'Removed tool "' + (removed.name || index) + '".');
        renderDialogBody();
        return true;
    }

    function addTimelineItem(itemInput) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        var nextNum = exp.timeline.length + 1;
        var yearNow = String(new Date().getFullYear());
        var item = Object.assign({
            id: 'milestone-' + nextNum,
            date: yearNow + '-01',
            year: yearNow,
            title: 'New Milestone',
            subtitle: 'Organization / Focus',
            description: 'Key achievement or training summary.',
            tags: ['Milestone']
        }, clone(itemInput || {}));
        exp.timeline.push(item);
        persistDataset('experience', exp, 'Added timeline milestone "' + item.title + '".');
        renderDialogBody();
        return clone(item);
    }

    function removeTimelineItem(index) {
        ensureLoadedSyncFallback();
        var exp = normalizeExperience(state.data.experience);
        if (index < 0 || index >= exp.timeline.length) return false;
        var removed = exp.timeline.splice(index, 1)[0];
        persistDataset('experience', exp, 'Removed timeline item "' + (removed.title || index) + '".');
        renderDialogBody();
        return true;
    }

    function getCustomSocialKeys(socialsObj) {
        var socials = socialsObj || (state.data && state.data.socials) || {};
        return Object.keys(socials).filter(function (k) {
            return CORE_SOCIAL_KEYS.indexOf(k) === -1;
        });
    }

    function updateSocials(nextSocials) {
        ensureLoadedSyncFallback();
        var merged = clone(nextSocials || {});
        persistDataset('socials', merged, 'Updated social & contact channels.');
        renderDialogBody();
        return clone(merged);
    }

    function addSocialChannel(label, value) {
        ensureLoadedSyncFallback();
        var nextSocials = clone(state.data.socials && typeof state.data.socials === 'object' ? state.data.socials : {});
        var baseLabel = String(label || '').trim();
        if (!baseLabel) {
            var idx = getCustomSocialKeys(nextSocials).length + 1;
            baseLabel = 'Social ' + idx;
            while (Object.prototype.hasOwnProperty.call(nextSocials, baseLabel)) {
                idx += 1;
                baseLabel = 'Social ' + idx;
            }
        }
        nextSocials[baseLabel] = value != null ? String(value).trim() : '';
        persistDataset('socials', nextSocials, 'Added social channel "' + baseLabel + '".');
        renderDialogBody();
        return clone(nextSocials);
    }

    function removeSocialChannel(key) {
        ensureLoadedSyncFallback();
        var k = String(key || '').trim();
        if (!k || !state.data.socials || CORE_SOCIAL_KEYS.indexOf(k) !== -1) return false;
        if (!Object.prototype.hasOwnProperty.call(state.data.socials, k)) return false;
        var nextSocials = clone(state.data.socials);
        delete nextSocials[k];
        persistDataset('socials', nextSocials, 'Removed social channel "' + k + '".');
        renderDialogBody();
        return true;
    }

    function updatePages(nextPagesOrUpdater) {
        ensureLoadedSyncFallback();
        var current = clone(state.data.pages || {});
        var next = typeof nextPagesOrUpdater === 'function'
            ? nextPagesOrUpdater(current)
            : Object.assign(current, clone(nextPagesOrUpdater || {}));
        persistDataset('pages', next, 'Updated page copy and scalable lists.');
        renderDialogBody();
        return clone(next);
    }

    function resetDataset(dataset) {
        var u = utils();
        if (u && typeof u.clearAdminOverride === 'function') {
            u.clearAdminOverride(dataset || 'all');
        }
        return loadAllData(true).then(function (data) {
            setStatus(dataset && dataset !== 'all'
                ? 'Reset "' + dataset + '" to factory defaults.'
                : 'Reset all customized datasets to factory defaults.');
            renderDialogBody();
            return data;
        });
    }

    function resetAll() {
        resetPasswordVerifier();
        return resetDataset('all');
    }

    /* ------------------------------------------------------------- Auth Gate Dialog & Creation */
    function getAuthDialog() {
        return typeof document !== 'undefined' ? document.getElementById(AUTH_DIALOG_ID) : null;
    }

    function removeAuthDialog() {
        var authDialog = getAuthDialog();
        if (!authDialog) return;
        if (authDialog.open && typeof authDialog.close === 'function') {
            authDialog.close();
        }
        authDialog.remove();
    }

    function attachDialogLightDismiss(dialog) {
        if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
            var downOutside = false;
            dialog.addEventListener('pointerdown', function (e) {
                var rect = dialog.getBoundingClientRect();
                downOutside = e.clientX < rect.left || e.clientX > rect.right ||
                              e.clientY < rect.top || e.clientY > rect.bottom;
            });
            dialog.addEventListener('click', function (e) {
                if (!downOutside) return;
                downOutside = false;
                var rect = dialog.getBoundingClientRect();
                var inDialog = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (!inDialog && typeof dialog.close === 'function') {
                    dialog.close();
                }
            });
        }
    }

    function ensureAuthDialog() {
        if (typeof document === 'undefined' || !document.body) return null;
        var existing = getAuthDialog();
        if (existing) return existing;

        var dialog = document.createElement('dialog');
        dialog.id = AUTH_DIALOG_ID;
        dialog.className = 'admin-auth-dialog';
        dialog.setAttribute('closedby', 'any');
        dialog.setAttribute('aria-labelledby', 'admin-auth-title');

        dialog.innerHTML =
            '<form class="admin-auth-card" data-admin-auth-form autocomplete="off">' +
                '<div class="admin-auth-card__head">' +
                    '<div>' +
                        '<span class="admin-badge">Protected Studio</span>' +
                        '<h2 id="admin-auth-title">Unlock Admin Studio</h2>' +
                    '</div>' +
                    '<button type="button" class="admin-btn admin-btn--ghost" data-admin-auth-close aria-label="Cancel">Close</button>' +
                '</div>' +
                '<p class="admin-auth-card__hint">Enter your administrator password to mount and edit portfolio content.</p>' +
                '<label class="admin-field">' +
                    '<span>Password</span>' +
                    '<input type="password" name="adminPassword" autocomplete="current-password" required autofocus placeholder="Enter admin password">' +
                '</label>' +
                '<p class="admin-auth-error" data-admin-auth-error hidden role="alert"></p>' +
                '<div class="admin-form__actions">' +
                    '<button type="submit" class="admin-btn admin-btn--primary">Unlock Studio</button>' +
                    '<button type="button" class="admin-btn" data-admin-auth-close>Cancel</button>' +
                '</div>' +
            '</form>';

        document.body.appendChild(dialog);
        attachDialogLightDismiss(dialog);

        dialog.addEventListener('close', function () {
            if (!state.authenticated) {
                dialog.remove();
            }
        });

        dialog.addEventListener('click', function (e) {
            if (e.target.closest('[data-admin-auth-close]')) {
                removeAuthDialog();
            }
        });

        dialog.addEventListener('submit', function (e) {
            var form = e.target.closest('[data-admin-auth-form]');
            if (!form) return;
            e.preventDefault();
            var pwInput = form.querySelector('input[name="adminPassword"]');
            var errEl = form.querySelector('[data-admin-auth-error]');
            var pw = pwInput ? pwInput.value : '';
            if (pwInput) pwInput.value = '';

            if (verifyPassword(pw)) {
                if (errEl) {
                    errEl.textContent = '';
                    errEl.hidden = true;
                }
                var targetTab = state.pendingTab;
                state.pendingTab = null;
                removeAuthDialog();
                open(targetTab || undefined);
            } else {
                if (errEl) {
                    errEl.textContent = 'Incorrect password. Access denied.';
                    errEl.hidden = false;
                }
                if (pwInput && typeof pwInput.focus === 'function') {
                    pwInput.focus();
                }
            }
        });

        return dialog;
    }

    function getDialog() {
        return typeof document !== 'undefined' ? document.getElementById(DIALOG_ID) : null;
    }

    function ensureDialog() {
        if (!state.authenticated) return null;
        if (typeof document === 'undefined' || !document.body) return null;
        var dialog = getDialog();
        if (dialog) return dialog;

        dialog = document.createElement('dialog');
        dialog.id = DIALOG_ID;
        dialog.className = 'admin-dialog';
        dialog.setAttribute('closedby', 'any');
        dialog.setAttribute('aria-labelledby', 'admin-dialog-title');

        var tabsHtml = TABS.map(function (tab, idx) {
            var active = tab.key === state.activeTab || (idx === 0 && !state.activeTab);
            return '<button type="button" class="admin-tab" role="tab"' +
                ' id="admin-tab-' + tab.key + '"' +
                ' data-admin-tab="' + tab.key + '"' +
                ' aria-controls="admin-panel-' + tab.key + '"' +
                ' aria-selected="' + (active ? 'true' : 'false') + '"' +
                ' tabindex="' + (active ? '0' : '-1') + '">' +
                '<span class="admin-tab__label">' + esc(tab.label) + '</span>' +
                '<span class="admin-tab__count" data-admin-tab-count="' + tab.key + '" hidden></span>' +
                '</button>';
        }).join('');

        var panelsHtml = TABS.map(function (tab) {
            var active = tab.key === state.activeTab;
            return '<div class="admin-panel" role="tabpanel"' +
                ' id="admin-panel-' + tab.key + '"' +
                ' data-admin-panel="' + tab.key + '"' +
                ' aria-labelledby="admin-tab-' + tab.key + '"' +
                (active ? '' : ' hidden="until-found"') + '>' +
                '<div class="admin-panel__inner" data-admin-panel-body="' + tab.key + '"></div>' +
                '</div>';
        }).join('');

        dialog.innerHTML =
            '<div class="admin-shell">' +
                '<header class="admin-header">' +
                    '<div class="admin-header__title">' +
                        '<div class="admin-header__eyebrow">' +
                            '<span class="admin-badge">Hidden Admin Studio</span>' +
                            '<kbd class="admin-kbd" title="Keyboard shortcut">Alt+Shift+A</kbd>' +
                            '<span class="admin-override-pill" data-admin-override-pill>Factory Defaults</span>' +
                        '</div>' +
                        '<h2 id="admin-dialog-title">Portfolio Content &amp; Schema Manager</h2>' +
                    '</div>' +
                    '<div class="admin-header__actions">' +
                        '<span class="admin-status" role="status" aria-live="polite" data-admin-status></span>' +
                        '<button type="button" class="admin-btn" data-admin-action="sync-all-disk" title="Write all JSON data directly to Project Files/data/">Write to Code</button>' +
                        '<button type="button" class="admin-btn" data-admin-action="toggle-password-form">Change Password</button>' +
                        '<button type="button" class="admin-btn" data-admin-action="lock-admin" title="Lock Admin Studio and remove dialog from DOM">Lock</button>' +
                        '<button type="button" class="admin-btn admin-btn--ghost" data-admin-action="close" aria-label="Close Admin Studio">Close</button>' +
                    '</div>' +
                '</header>' +
                '<div class="admin-password-drawer" data-admin-password-drawer hidden>' +
                    '<form class="admin-card admin-form" data-admin-form="change-password" autocomplete="off">' +
                        '<div class="admin-card__head">' +
                            '<h3>Change Admin Password</h3>' +
                            '<button type="button" class="admin-btn admin-btn--ghost" data-admin-action="toggle-password-form">Cancel</button>' +
                        '</div>' +
                        '<div class="admin-form__grid">' +
                            '<label class="admin-field"><span>Current Password</span><input type="password" name="currentPassword" required autocomplete="current-password"></label>' +
                            '<label class="admin-field"><span>New Password</span><input type="password" name="newPassword" required minlength="4" autocomplete="new-password" placeholder="At least 4 characters"></label>' +
                            '<label class="admin-field"><span>Confirm New Password</span><input type="password" name="confirmPassword" required minlength="4" autocomplete="new-password"></label>' +
                        '</div>' +
                        '<p class="admin-auth-error" data-admin-change-pw-error hidden role="alert"></p>' +
                        '<div class="admin-form__actions">' +
                            '<button type="submit" class="admin-btn admin-btn--primary">Update Password</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
                '<div class="admin-tablist" role="tablist" focusgroup="tablist nomemory" aria-label="Admin Studio Sections">' +
                    tabsHtml +
                '</div>' +
                '<div class="admin-panels">' +
                    panelsHtml +
                '</div>' +
            '</div>';

        document.body.appendChild(dialog);
        bindDialogEvents(dialog);
        return dialog;
    }

    function activateTab(tabKey, focusTab) {
        var exists = TABS.some(function (t) { return t.key === tabKey; });
        if (!exists) return;
        state.activeTab = tabKey;

        var dialog = getDialog();
        if (!dialog) return;

        TABS.forEach(function (t) {
            var btn = dialog.querySelector('#admin-tab-' + t.key);
            var panel = dialog.querySelector('#admin-panel-' + t.key);
            var active = t.key === tabKey;
            if (btn) {
                btn.setAttribute('aria-selected', active ? 'true' : 'false');
                btn.setAttribute('tabindex', active ? '0' : '-1');
                if (active && focusTab) btn.focus();
            }
            if (panel) {
                if (active) {
                    panel.removeAttribute('hidden');
                } else {
                    panel.setAttribute('hidden', 'until-found');
                }
            }
        });

        renderDialogBody();
    }

    function bindDialogEvents(dialog) {
        /* Fallback light-dismiss when native closedBy is not supported by engine. */
        if (typeof HTMLDialogElement !== 'undefined' && !('closedBy' in HTMLDialogElement.prototype)) {
            var downOutside = false;
            dialog.addEventListener('pointerdown', function (e) {
                var rect = dialog.getBoundingClientRect();
                downOutside = e.clientX < rect.left || e.clientX > rect.right ||
                              e.clientY < rect.top || e.clientY > rect.bottom;
            });
            dialog.addEventListener('click', function (e) {
                if (!downOutside) return;
                downOutside = false;
                var rect = dialog.getBoundingClientRect();
                var inDialog = e.clientX >= rect.left && e.clientX <= rect.right &&
                               e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (!inDialog) {
                    dialog.close();
                }
            });
        }

        /* Auto-switch tab when browser find-in-page matches hidden="until-found". */
        TABS.forEach(function (t) {
            var panel = dialog.querySelector('#admin-panel-' + t.key);
            if (panel) {
                panel.addEventListener('beforematch', function () {
                    activateTab(t.key, false);
                });
            }
        });

        var tablist = dialog.querySelector('[role="tablist"]');
        if (tablist) {
            tablist.addEventListener('click', function (e) {
                var tab = e.target.closest('[role="tab"]');
                if (!tab) return;
                activateTab(tab.getAttribute('data-admin-tab'), false);
            });
            tablist.addEventListener('keydown', function (e) {
                var current = e.target.closest('[role="tab"]');
                if (!current) return;
                var keys = TABS.map(function (t) { return t.key; });
                var idx = keys.indexOf(current.getAttribute('data-admin-tab'));
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    activateTab(keys[(idx + 1) % keys.length], true);
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    activateTab(keys[(idx - 1 + keys.length) % keys.length], true);
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    activateTab(keys[0], true);
                } else if (e.key === 'End') {
                    e.preventDefault();
                    activateTab(keys[keys.length - 1], true);
                }
            });
        }

        dialog.addEventListener('click', handleDialogClick);
        dialog.addEventListener('change', handleDialogChange);
        dialog.addEventListener('submit', handleDialogSubmit);
    }

    /* ------------------------------------------------------------- Panel Renderers */
    function countCustomOverrides() {
        var u = utils();
        if (!u || typeof u.getAdminOverride !== 'function') return 0;
        return ['projects', 'experience', 'pages', 'socials'].reduce(function (acc, ds) {
            return acc + (u.getAdminOverride(ds) !== null ? 1 : 0);
        }, 0);
    }

    function updateTabCounts(dialog) {
        if (!dialog) return;
        var projects = state.data.projects || [];
        var selectedProject = projects.find(function (p) { return String(p.id) === String(state.selectedDocProjectId); }) || projects[0];
        var docCount = selectedProject && Array.isArray(selectedProject.documentation) ? selectedProject.documentation.length : 0;
        var exp = normalizeExperience(state.data.experience);
        var skillsCount = exp.languages.length + exp.tools.length;
        var timelineCount = exp.timeline.length;
        var customCount = countCustomOverrides();

        var counts = {
            projects: projects.length,
            documentation: docCount,
            skills: skillsCount,
            timeline: timelineCount,
            pages: CORE_SOCIAL_KEYS.length + getCustomSocialKeys().length
        };

        Object.keys(counts).forEach(function (key) {
            var el = dialog.querySelector('[data-admin-tab-count="' + key + '"]');
            if (!el) return;
            var val = counts[key];
            if (val > 0 || key === 'projects') {
                el.textContent = String(val);
                el.hidden = false;
            } else {
                el.textContent = '';
                el.hidden = true;
            }
        });

        var overridePill = dialog.querySelector('[data-admin-override-pill]');
        if (overridePill) {
            overridePill.textContent = customCount > 0
                ? (customCount + ' Custom Override' + (customCount === 1 ? '' : 's'))
                : 'Factory Defaults';
            overridePill.classList.toggle('is-custom', customCount > 0);
        }
    }

    function renderDialogBody() {
        var dialog = getDialog();
        if (!dialog) return;

        var statusEl = dialog.querySelector('[data-admin-status]');
        if (statusEl && state.statusMessage) {
            statusEl.textContent = state.statusMessage;
        }

        updateTabCounts(dialog);

        var tab = state.activeTab || 'projects';
        var body = dialog.querySelector('[data-admin-panel-body="' + tab + '"]');
        if (!body) return;

        if (tab === 'projects') body.innerHTML = renderProjectsPanel();
        else if (tab === 'documentation') body.innerHTML = renderDocumentationPanel();
        else if (tab === 'skills') body.innerHTML = renderSkillsPanel();
        else if (tab === 'timeline') body.innerHTML = renderTimelinePanel();
        else if (tab === 'pages') body.innerHTML = renderPagesSocialsPanel();
    }

    function renderProjectsPanel() {
        var projects = state.data.projects || [];
        var idx = Math.min(state.selectedProjectIndex, Math.max(0, projects.length - 1));
        state.selectedProjectIndex = idx;
        var selected = projects[idx] || null;

        var listHtml = projects.length
            ? projects.map(function (p, i) {
                var activeClass = i === idx ? ' is-selected' : '';
                var numLabel = String(i + 1).padStart(2, '0');
                return '<div class="admin-list-item' + activeClass + '">' +
                    '<button type="button" class="admin-list-item__select" data-admin-action="select-project" data-index="' + i + '">' +
                        '<span class="admin-list-item__head">' +
                            '<span class="admin-index-badge">' + numLabel + '</span>' +
                            '<span class="admin-list-item__title">' + esc(p.title || p.id || ('Project ' + (i + 1))) + '</span>' +
                        '</span>' +
                        '<span class="admin-list-item__badges">' +
                            '<span class="admin-mini-badge">' + esc(p.status || 'Draft') + '</span>' +
                            (p.featured ? '<span class="admin-mini-badge admin-mini-badge--accent">Featured</span>' : '') +
                        '</span>' +
                    '</button>' +
                    '<div class="admin-item-controls">' +
                        '<button type="button" class="admin-icon-btn" data-admin-action="move-project" data-index="' + i + '" data-delta="-1" title="Move Up" aria-label="Move project up"' + (i === 0 ? ' disabled' : '') + '>\u2191</button>' +
                        '<button type="button" class="admin-icon-btn" data-admin-action="move-project" data-index="' + i + '" data-delta="1" title="Move Down" aria-label="Move project down"' + (i === projects.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
                        '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-project" data-index="' + i + '" title="Delete project" aria-label="Delete project">\u00d7</button>' +
                    '</div>' +
                '</div>';
            }).join('')
            : '<p class="admin-empty">No projects yet. Click "+ Add Project" to create one.</p>';

        var editorHtml = '<p class="admin-empty">Select a project from the list or add a new project.</p>';
        if (selected) {
            var links = selected.links || {};
            var demo = selected.demo || {};
            var previewHref = esc(siteRoot() + 'projects/project.html?id=' + encodeURIComponent(selected.id || '1'));
            editorHtml =
                '<div class="admin-detail__topbar">' +
                    '<div class="admin-detail__identity">' +
                        '<span class="admin-pill">Project ' + String(idx + 1).padStart(2, '0') + '</span>' +
                        '<h3>' + esc(selected.title || selected.id) + '</h3>' +
                        '<code class="admin-code-badge">id: ' + esc(selected.id || '') + '</code>' +
                    '</div>' +
                    '<div class="admin-item-controls">' +
                        '<button type="button" class="admin-btn" data-admin-action="jump-project-docs" data-project-id="' + esc(selected.id || '') + '">Edit Documentation \u2192</button>' +
                        '<a class="admin-btn" href="' + previewHref + '" target="_blank" rel="noopener noreferrer">Preview Page \u2197</a>' +
                    '</div>' +
                '</div>' +
                '<form class="admin-form" data-admin-form="project" data-index="' + idx + '">' +
                    '<fieldset class="admin-fieldset"><legend>Identity &amp; Publication Status</legend>' +
                        '<div class="admin-form__grid">' +
                            '<label class="admin-field"><span>ID / Slug</span><input name="id" required autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(selected.id || '') + '"></label>' +
                            '<label class="admin-field"><span>Title</span><input name="title" required value="' + esc(selected.title || '') + '"></label>' +
                            '<label class="admin-field"><span>Status</span><input name="status" value="' + esc(selected.status || '') + '" placeholder="Live / In Progress"></label>' +
                            '<label class="admin-field admin-field--checkbox"><input type="checkbox" name="featured"' + (selected.featured ? ' checked' : '') + '><span>Featured on Home Gallery</span></label>' +
                        '</div>' +
                    '</fieldset>' +
                    '<fieldset class="admin-fieldset"><legend>Case Study Copy &amp; Benchmarks</legend>' +
                        '<label class="admin-field"><span>Summary (Card Excerpt)</span><textarea name="summary" rows="2">' + esc(selected.summary || '') + '</textarea></label>' +
                        '<label class="admin-field"><span>Full Description</span><textarea name="description" rows="4">' + esc(selected.description || '') + '</textarea></label>' +
                        '<div class="admin-form__grid">' +
                            '<label class="admin-field"><span>Highlights (one per line)</span><textarea name="highlights" rows="3">' + esc((selected.highlights || []).join('\n')) + '</textarea></label>' +
                            '<label class="admin-field"><span>Metrics ("Label | Value" per line)</span><textarea name="metrics" rows="3">' + esc(formatMetricsText(selected.metrics)) + '</textarea></label>' +
                        '</div>' +
                    '</fieldset>' +
                    '<fieldset class="admin-fieldset"><legend>Media &amp; Stack Taxonomy</legend>' +
                        '<div class="admin-form__grid">' +
                            '<label class="admin-field"><span>Image Path / URL</span><input name="image" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(selected.image || '') + '" placeholder="assets/images/..."></label>' +
                            '<label class="admin-field"><span>Image Alt Text</span><input name="imageAlt" value="' + esc(selected.imageAlt || '') + '"></label>' +
                            '<label class="admin-field"><span>Technologies (comma-separated)</span><input name="tech" value="' + esc((selected.tech || []).join(', ')) + '"></label>' +
                            '<label class="admin-field"><span>Tags (comma-separated)</span><input name="tags" value="' + esc((selected.tags || []).join(', ')) + '"></label>' +
                        '</div>' +
                    '</fieldset>' +
                    '<fieldset class="admin-fieldset"><legend>Links &amp; Interactive Demo</legend>' +
                        '<div class="admin-form__grid">' +
                            '<label class="admin-field"><span>Repository / GitHub URL</span><input name="repo" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(links.repo || links.github || '') + '"></label>' +
                            '<label class="admin-field"><span>Live URL</span><input name="live" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(links.live || '') + '"></label>' +
                            '<label class="admin-field"><span>Docs Link</span><input name="docs" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(links.docs || '') + '"></label>' +
                            '<label class="admin-field"><span>Interactive Demo URL</span><input name="demoUrl" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(demo.url || '') + '"></label>' +
                        '</div>' +
                        '<label class="admin-field"><span>Demo Instructions</span><input name="demoInstructions" value="' + esc(demo.instructions || '') + '"></label>' +
                    '</fieldset>' +
                    '<div class="admin-form__actions admin-form__actions--sticky">' +
                        '<button type="submit" class="admin-btn admin-btn--primary">Save Project</button>' +
                        '<button type="button" class="admin-btn" data-admin-action="duplicate-project" data-index="' + idx + '">Duplicate</button>' +
                    '</div>' +
                '</form>';
        }

        var sortOptions = normalizeExperience(state.data.experience).projectSortOptions;
        var sortRules = [
            { value: 'language', label: 'Language / Tech Priority' },
            { value: 'title-asc', label: 'Title A-Z' },
            { value: 'title-desc', label: 'Title Z-A' },
            { value: 'status', label: 'Status Priority' },
            { value: 'featured', label: 'Featured First' },
            { value: 'tech-count', label: 'Most Technologies' },
            { value: 'reverse', label: 'Newest / Reverse Order' }
        ];
        var sortRowsHtml = sortOptions.length
            ? '<div class="admin-cards-grid">' + sortOptions.map(function (opt, i) {
                var ruleOptions = sortRules.map(function (rule) {
                    return '<option value="' + esc(rule.value) + '"' + (opt.by === rule.value ? ' selected' : '') + '>' + esc(rule.label) + '</option>';
                }).join('');
                return '<form class="admin-card admin-form" data-admin-form="sort-option" data-index="' + i + '">' +
                    '<div class="admin-card__head">' +
                        '<strong>' + esc(opt.label || opt.id || ('Sort ' + (i + 1))) + '</strong>' +
                        '<div class="admin-item-controls">' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-sort-option" data-index="' + i + '" data-delta="-1" aria-label="Move sort option up"' + (i === 0 ? ' disabled' : '') + '>\u2191</button>' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-sort-option" data-index="' + i + '" data-delta="1" aria-label="Move sort option down"' + (i === sortOptions.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
                            '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-sort-option" data-index="' + i + '" aria-label="Delete sort option">\u00d7</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Button Label</span><input name="label" required value="' + esc(opt.label || '') + '" placeholder="e.g. Title A-Z"></label>' +
                        '<label class="admin-field"><span>Sort Rule</span><select name="by">' + ruleOptions + '</select></label>' +
                        '<label class="admin-field"><span>Target Language / Status (optional)</span><input name="target" value="' + esc(opt.target || '') + '" placeholder="e.g. TypeScript, Live"></label>' +
                    '</div>' +
                    '<div class="admin-form__actions"><button type="submit" class="admin-btn admin-btn--primary">Save Sort Option</button></div>' +
                '</form>';
            }).join('') + '</div>'
            : '<p class="admin-empty">No custom sort options configured.</p>';

        return '<div class="admin-stack">' +
            '<div class="admin-split">' +
                '<aside class="admin-sidebar">' +
                    '<div class="admin-toolbar">' +
                        '<h3>Projects (' + projects.length + ')</h3>' +
                        '<button type="button" class="admin-btn admin-btn--primary" data-admin-action="add-project">+ Add Project</button>' +
                    '</div>' +
                    '<div class="admin-list">' + listHtml + '</div>' +
                '</aside>' +
                '<section class="admin-detail">' + editorHtml + '</section>' +
            '</div>' +
            '<section class="admin-section">' +
                '<div class="admin-toolbar">' +
                    '<h3>Custom Project Sorting Options (' + sortOptions.length + ')</h3>' +
                    '<button type="button" class="admin-btn admin-btn--primary" data-admin-action="add-sort-option">+ Add Sort Option</button>' +
                '</div>' +
                sortRowsHtml +
            '</section>' +
        '</div>';
    }

    function renderDocumentationPanel() {
        var projects = state.data.projects || [];
        if (!projects.length) {
            return '<p class="admin-empty">Create a project in the Projects tab first to attach documentation sections.</p>';
        }

        var selectedProject = projects.find(function (p) { return String(p.id) === String(state.selectedDocProjectId); }) || projects[0];
        state.selectedDocProjectId = String(selectedProject.id);
        var sections = Array.isArray(selectedProject.documentation) ? selectedProject.documentation : [];
        var liveDocHref = esc(siteRoot() + 'docs/doc.html?id=' + encodeURIComponent(selectedProject.id));

        var selectorOptions = projects.map(function (p) {
            return '<option value="' + esc(p.id) + '"' + (String(p.id) === String(selectedProject.id) ? ' selected' : '') + '>' +
                esc(p.title || p.id) + ' (' + ((p.documentation || []).length) + ' sections)' +
                '</option>';
        }).join('');

        var sectionsHtml = sections.length
            ? sections.map(function (sec, idx) {
                var secTitle = (sec && sec.heading) ? sec.heading : ('Section ' + (idx + 1));
                return '<form class="admin-card admin-form" data-admin-form="doc-section" data-project-id="' + esc(selectedProject.id) + '" data-index="' + idx + '">' +
                    '<div class="admin-card__head">' +
                        '<div class="admin-card__title-wrap">' +
                            '<span class="admin-pill">Section ' + String(idx + 1).padStart(2, '0') + '</span>' +
                            '<strong>' + esc(secTitle) + '</strong>' +
                        '</div>' +
                        '<div class="admin-item-controls">' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-doc" data-project-id="' + esc(selectedProject.id) + '" data-index="' + idx + '" data-delta="-1" aria-label="Move section up"' + (idx === 0 ? ' disabled' : '') + '>\u2191</button>' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-doc" data-project-id="' + esc(selectedProject.id) + '" data-index="' + idx + '" data-delta="1" aria-label="Move section down"' + (idx === sections.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
                            '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-doc" data-project-id="' + esc(selectedProject.id) + '" data-index="' + idx + '" aria-label="Delete section">\u00d7</button>' +
                        '</div>' +
                    '</div>' +
                    '<label class="admin-field"><span>Section Heading</span><input name="heading" required value="' + esc(sec.heading || '') + '"></label>' +
                    '<label class="admin-field"><span>Body</span><textarea name="body" rows="6">' + esc(sec.body || '') + '</textarea><span class="admin-field__hint">Supports **bold**, `inline code`, bullet lists (- item), and numbered lists (1. item).</span></label>' +
                    '<div class="admin-form__actions">' +
                        '<button type="submit" class="admin-btn admin-btn--primary">Save Section</button>' +
                    '</div>' +
                '</form>';
            }).join('')
            : '<p class="admin-empty">No documentation sections for this project yet.</p>';

        return '<div class="admin-stack">' +
            '<div class="admin-toolbar">' +
                '<label class="admin-inline-select"><span>Project:</span><select data-admin-select="doc-project">' + selectorOptions + '</select></label>' +
                '<div class="admin-item-controls">' +
                    '<a class="admin-btn" href="' + liveDocHref + '" target="_blank" rel="noopener noreferrer">Open Live Docs \u2197</a>' +
                    '<button type="button" class="admin-btn admin-btn--primary" data-admin-action="add-doc" data-project-id="' + esc(selectedProject.id) + '">+ Add Doc Section</button>' +
                '</div>' +
            '</div>' +
            sectionsHtml +
        '</div>';
    }

    function renderSkillsPanel() {
        var exp = state.data.experience || { languages: [], tools: [] };
        var langs = exp.languages || [];
        var tools = exp.tools || [];

        var langsHtml = langs.length
            ? '<div class="admin-cards-grid">' + langs.map(function (item, idx) {
                var iconSrc = esc(siteRoot() + 'assets/icons/skills/' + (item.icon || 'code') + '.svg');
                return '<form class="admin-card admin-form" data-admin-form="language" data-index="' + idx + '">' +
                    '<div class="admin-card__head">' +
                        '<div class="admin-card__title-wrap">' +
                            '<span class="admin-skill-chip"><img src="' + iconSrc + '" alt="" width="16" height="16" loading="lazy"></span>' +
                            '<strong>' + esc(item.name || ('Skill ' + (idx + 1))) + '</strong>' +
                        '</div>' +
                        '<div class="admin-item-controls">' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-lang" data-index="' + idx + '" data-delta="-1" aria-label="Move skill up"' + (idx === 0 ? ' disabled' : '') + '>\u2191</button>' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-lang" data-index="' + idx + '" data-delta="1" aria-label="Move skill down"' + (idx === langs.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
                            '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-lang" data-index="' + idx + '" aria-label="Delete skill">\u00d7</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Name</span><input name="name" required value="' + esc(item.name || '') + '"></label>' +
                        '<label class="admin-field"><span>Icon Slug</span><input name="icon" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(item.icon || '') + '" placeholder="javascript, html, css..."></label>' +
                        '<label class="admin-field"><span>Proficiency / Level</span><input name="level" value="' + esc(item.level || '') + '"></label>' +
                    '</div>' +
                    '<div class="admin-form__actions"><button type="submit" class="admin-btn admin-btn--primary">Save Skill</button></div>' +
                '</form>';
            }).join('') + '</div>'
            : '<p class="admin-empty">No skills listed yet.</p>';

        var toolsHtml = tools.length
            ? '<div class="admin-cards-grid">' + tools.map(function (item, idx) {
                var iconSrc = esc(siteRoot() + 'assets/icons/skills/' + (item.icon || 'vscode') + '.svg');
                return '<form class="admin-card admin-form" data-admin-form="tool" data-index="' + idx + '">' +
                    '<div class="admin-card__head">' +
                        '<div class="admin-card__title-wrap">' +
                            '<span class="admin-skill-chip"><img src="' + iconSrc + '" alt="" width="16" height="16" loading="lazy"></span>' +
                            '<strong>' + esc(item.name || ('Tool ' + (idx + 1))) + '</strong>' +
                        '</div>' +
                        '<div class="admin-item-controls">' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-tool" data-index="' + idx + '" data-delta="-1" aria-label="Move tool up"' + (idx === 0 ? ' disabled' : '') + '>\u2191</button>' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-tool" data-index="' + idx + '" data-delta="1" aria-label="Move tool down"' + (idx === tools.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
                            '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-tool" data-index="' + idx + '" aria-label="Delete tool">\u00d7</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Name</span><input name="name" required value="' + esc(item.name || '') + '"></label>' +
                        '<label class="admin-field"><span>Icon Slug</span><input name="icon" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(item.icon || '') + '" placeholder="git, github, vscode..."></label>' +
                        '<label class="admin-field"><span>Level</span><input name="level" value="' + esc(item.level || '') + '"></label>' +
                        '<label class="admin-field"><span>Short Summary</span><input name="summary" value="' + esc(item.summary || '') + '"></label>' +
                    '</div>' +
                    '<label class="admin-field"><span>Description</span><textarea name="description" rows="2">' + esc(item.description || '') + '</textarea></label>' +
                    '<div class="admin-form__actions"><button type="submit" class="admin-btn admin-btn--primary">Save Tool</button></div>' +
                '</form>';
            }).join('') + '</div>'
            : '<p class="admin-empty">No tools listed yet.</p>';

        return '<div class="admin-stack">' +
            '<div class="admin-section">' +
                '<div class="admin-toolbar"><h3>Skills &amp; Languages (' + langs.length + ')</h3><button type="button" class="admin-btn admin-btn--primary" data-admin-action="add-lang">+ Add Skill</button></div>' +
                langsHtml +
            '</div>' +
            '<div class="admin-section">' +
                '<div class="admin-toolbar"><h3>Tools &amp; Platforms (' + tools.length + ')</h3><button type="button" class="admin-btn admin-btn--primary" data-admin-action="add-tool">+ Add Tool</button></div>' +
                toolsHtml +
            '</div>' +
        '</div>';
    }

    function renderTimelinePanel() {
        var timeline = (state.data.experience && state.data.experience.timeline) || [];
        var rows = timeline.length
            ? timeline.map(function (item, idx) {
                var numLabel = String(idx + 1).padStart(2, '0');
                return '<form class="admin-card admin-form" data-admin-form="timeline" data-index="' + idx + '">' +
                    '<div class="admin-card__head">' +
                        '<div class="admin-card__title-wrap">' +
                            '<span class="admin-pill">' + numLabel + '</span>' +
                            (item.year ? '<span class="admin-mini-badge admin-mini-badge--accent">' + esc(item.year) + '</span>' : '') +
                            '<strong>' + esc(item.title || ('Milestone ' + (idx + 1))) + '</strong>' +
                        '</div>' +
                        '<div class="admin-item-controls">' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-timeline" data-index="' + idx + '" data-delta="-1" aria-label="Move item up"' + (idx === 0 ? ' disabled' : '') + '>\u2191</button>' +
                            '<button type="button" class="admin-icon-btn" data-admin-action="move-timeline" data-index="' + idx + '" data-delta="1" aria-label="Move item down"' + (idx === timeline.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
                            '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-timeline" data-index="' + idx + '" aria-label="Delete item">\u00d7</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>ID</span><input name="id" autocorrect="off" autocapitalize="none" spellcheck="false" value="' + esc(item.id || '') + '"></label>' +
                        '<label class="admin-field"><span>Year</span><input name="year" value="' + esc(item.year || '') + '"></label>' +
                        '<label class="admin-field"><span>Date (YYYY-MM)</span><input name="date" value="' + esc(item.date || '') + '"></label>' +
                        '<label class="admin-field"><span>Tags (comma-separated)</span><input name="tags" value="' + esc((item.tags || []).join(', ')) + '"></label>' +
                    '</div>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Title</span><input name="title" required value="' + esc(item.title || '') + '"></label>' +
                        '<label class="admin-field"><span>Subtitle / Institution</span><input name="subtitle" value="' + esc(item.subtitle || '') + '"></label>' +
                    '</div>' +
                    '<label class="admin-field"><span>Description</span><textarea name="description" rows="3">' + esc(item.description || '') + '</textarea></label>' +
                    '<div class="admin-form__actions"><button type="submit" class="admin-btn admin-btn--primary">Save Milestone</button></div>' +
                '</form>';
            }).join('')
            : '<p class="admin-empty">No timeline entries yet.</p>';

        return '<div class="admin-stack">' +
            '<div class="admin-toolbar">' +
                '<h3>Experience Timeline &amp; Trainings (' + timeline.length + ')</h3>' +
                '<button type="button" class="admin-btn admin-btn--primary" data-admin-action="add-timeline">+ Add Milestone</button>' +
            '</div>' +
            rows +
        '</div>';
    }

    function renderPagesSocialsPanel() {
        var socials = state.data.socials || {};
        var pages = state.data.pages || {};
        var homeHero = (pages.home && pages.home.hero) || {};
        var projectsHero = (pages.projects && pages.projects.hero) || {};
        var projectsFeatured = (pages.projects && pages.projects.featured) || {};
        var aboutProfile = (pages.about && pages.about.profile) || {};
        var contactHero = (pages.contact && pages.contact.hero) || pages.contact || {};

        var homeActions = Array.isArray(homeHero.actions) ? homeHero.actions : [];
        var homeActionsHtml = homeActions.map(function (act, idx) {
            return '<div class="admin-row-group">' +
                '<input name="homeActionLabel_' + idx + '" placeholder="Label" value="' + esc(act.label || '') + '">' +
                '<input name="homeActionHref_' + idx + '" placeholder="Href" value="' + esc(act.href || '') + '">' +
                '<input name="homeActionVariant_' + idx + '" placeholder="className" value="' + esc(act.variant || act.className || 'button button-primary') + '">' +
                '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-home-action" data-index="' + idx + '" aria-label="Remove home CTA">\u00d7</button>' +
            '</div>';
        }).join('');

        var traitsArr = Array.isArray(aboutProfile.traits) ? aboutProfile.traits : [];
        var traitsText = traitsArr.map(function (t) {
            if (typeof t === 'string') return t;
            return t && (t.title || t.text) ? (t.title || t.text) : '';
        }).filter(Boolean).join('\n');

        var goalsArr = Array.isArray(aboutProfile.goals) ? aboutProfile.goals : [];
        var bioArr = Array.isArray(aboutProfile.bio) ? aboutProfile.bio : [];
        var customSocialKeys = getCustomSocialKeys(socials);
        var customSocialRows = customSocialKeys.map(function (key, idx) {
            return '<div class="admin-row-group admin-social-custom-row" data-social-custom-row="' + idx + '">' +
                '<input name="customSocialKey_' + idx + '" value="' + esc(key) + '" placeholder="Platform (e.g. X / Twitter, YouTube)">' +
                '<input name="customSocialValue_' + idx + '" value="' + esc(socials[key] || '') + '" placeholder="URL or handle">' +
                '<button type="button" class="admin-icon-btn admin-icon-btn--danger" data-admin-action="remove-social-channel" data-social-key="' + esc(key) + '" aria-label="Remove social channel ' + esc(key) + '">\u00d7</button>' +
            '</div>';
        }).join('');

        return '<div class="admin-stack">' +
            '<form class="admin-card admin-form" data-admin-form="socials">' +
                '<div class="admin-card__head">' +
                    '<h3>Contact &amp; Social Channels (socials.json)</h3>' +
                    '<button type="button" class="admin-btn admin-btn--primary" data-admin-action="add-social-channel">+ Add Social</button>' +
                '</div>' +
                '<div class="admin-form__grid">' +
                    '<label class="admin-field"><span>Email</span><input name="email" value="' + esc(socials.email || '') + '"></label>' +
                    '<label class="admin-field"><span>GitHub URL</span><input name="github" value="' + esc(socials.github || '') + '"></label>' +
                    '<label class="admin-field"><span>LinkedIn URL</span><input name="linkedin" value="' + esc(socials.linkedin || '') + '"></label>' +
                    '<label class="admin-field"><span>Discord Handle</span><input name="discord" value="' + esc(socials.discord || '') + '"></label>' +
                '</div>' +
                '<div class="admin-subtoolbar"><span>Additional Social Channels (' + customSocialKeys.length + ')</span></div>' +
                '<div class="admin-rows" data-admin-custom-socials>' + (customSocialRows || '<p class="admin-empty">No additional social channels yet. Click + Add Social to add more.</p>') + '</div>' +
                '<div class="admin-form__actions"><button type="submit" class="admin-btn admin-btn--primary">Save Socials</button></div>' +
            '</form>' +
            '<form class="admin-card admin-form" data-admin-form="pages">' +
                '<div class="admin-card__head"><h3>Page Copy &amp; Scalable Profile Lists (pages.json)</h3></div>' +
                '<fieldset class="admin-fieldset"><legend>Home Hero</legend>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Eyebrow</span><input name="homeEyebrow" value="' + esc(homeHero.eyebrow || '') + '"></label>' +
                        '<label class="admin-field"><span>Title</span><input name="homeTitle" value="' + esc(homeHero.title || '') + '"></label>' +
                    '</div>' +
                    '<label class="admin-field"><span>Lead</span><textarea name="homeLead" rows="2">' + esc(homeHero.lead || '') + '</textarea></label>' +
                    '<label class="admin-field"><span>CTA Note</span><input name="homeCtaNote" value="' + esc(homeHero.ctaNote || '') + '"></label>' +
                    '<div class="admin-subtoolbar"><span>Home Hero Action Buttons (' + homeActions.length + ')</span><button type="button" class="admin-btn" data-admin-action="add-home-action">+ Add Button</button></div>' +
                    '<div class="admin-rows">' + (homeActionsHtml || '<p class="admin-empty">No hero action buttons.</p>') + '</div>' +
                '</fieldset>' +
                '<fieldset class="admin-fieldset"><legend>About Profile &amp; Scalable Lists</legend>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Display Name</span><input name="aboutName" value="' + esc(aboutProfile.name || '') + '"></label>' +
                        '<label class="admin-field"><span>Role</span><input name="aboutRole" value="' + esc(aboutProfile.role || '') + '"></label>' +
                        '<label class="admin-field"><span>Location</span><input name="aboutLocation" value="' + esc(aboutProfile.location || '') + '"></label>' +
                    '</div>' +
                    '<label class="admin-field"><span>Profile Summary</span><textarea name="aboutSummary" rows="2">' + esc(aboutProfile.summary || '') + '</textarea></label>' +
                    '<label class="admin-field"><span>Bio Paragraphs (one per line)</span><textarea name="aboutBio" rows="3">' + esc(bioArr.join('\n')) + '</textarea></label>' +
                    '<label class="admin-field"><span>Goals (one per line)</span><textarea name="aboutGoals" rows="3">' + esc(goalsArr.join('\n')) + '</textarea></label>' +
                    '<label class="admin-field"><span>Rotating Traits (one per line)</span><textarea name="aboutTraits" rows="3">' + esc(traitsText) + '</textarea></label>' +
                '</fieldset>' +
                '<fieldset class="admin-fieldset"><legend>Projects &amp; Contact Copy</legend>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Projects Eyebrow</span><input name="projectsEyebrow" value="' + esc(projectsHero.eyebrow || '') + '"></label>' +
                        '<label class="admin-field"><span>Projects Title</span><input name="projectsTitle" value="' + esc(projectsHero.title || '') + '"></label>' +
                    '</div>' +
                    '<label class="admin-field"><span>Projects Lead</span><textarea name="projectsLead" rows="2">' + esc(projectsHero.lead || '') + '</textarea></label>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Featured Callout Tag</span><input name="featuredTag" value="' + esc(projectsFeatured.tag || '') + '"></label>' +
                        '<label class="admin-field"><span>Featured Callout Title</span><input name="featuredTitle" value="' + esc(projectsFeatured.title || '') + '"></label>' +
                    '</div>' +
                    '<div class="admin-form__grid">' +
                        '<label class="admin-field"><span>Contact Eyebrow</span><input name="contactEyebrow" value="' + esc(contactHero.eyebrow || '') + '"></label>' +
                        '<label class="admin-field"><span>Contact Title</span><input name="contactTitle" value="' + esc(contactHero.title || '') + '"></label>' +
                    '</div>' +
                    '<label class="admin-field"><span>Contact Lead</span><textarea name="contactLead" rows="2">' + esc(contactHero.lead || '') + '</textarea></label>' +
                '</fieldset>' +
                '<div class="admin-form__actions"><button type="submit" class="admin-btn admin-btn--primary">Save Page Copy &amp; Lists</button></div>' +
            '</form>' +
        '</div>';
    }

    /* ------------------------------------------------------------- Dialog Action Handlers */
    function collectSocialsFromForm(form) {
        if (!form) return clone(state.data.socials || {});
        var fd = new FormData(form);
        var nextSocials = {
            email: String(fd.get('email') || '').trim(),
            github: String(fd.get('github') || '').trim(),
            linkedin: String(fd.get('linkedin') || '').trim(),
            discord: String(fd.get('discord') || '').trim()
        };
        var keyInputs = form.querySelectorAll('input[name^="customSocialKey_"]');
        for (var i = 0; i < keyInputs.length; i++) {
            var inputName = keyInputs[i].getAttribute('name') || '';
            var rowIdx = inputName.replace('customSocialKey_', '');
            var customKey = String(keyInputs[i].value || '').trim();
            var valInput = form.querySelector('input[name="customSocialValue_' + rowIdx + '"]');
            var customVal = String(valInput ? valInput.value : (fd.get('customSocialValue_' + rowIdx) || '')).trim();
            if (customKey && CORE_SOCIAL_KEYS.indexOf(customKey.toLowerCase()) === -1) {
                nextSocials[customKey] = customVal;
            }
        }
        return nextSocials;
    }

    function handleDialogClick(e) {
        var btn = e.target.closest('[data-admin-action]');
        if (!btn) return;
        var action = btn.getAttribute('data-admin-action');
        var idx = parseInt(btn.getAttribute('data-index'), 10);
        var delta = parseInt(btn.getAttribute('data-delta'), 10);
        var projectId = btn.getAttribute('data-project-id');
        var dataset = btn.getAttribute('data-dataset');

        if (action === 'close') {
            close();
        } else if (action === 'select-project') {
            state.selectedProjectIndex = idx;
            renderDialogBody();
        } else if (action === 'jump-project-docs' && projectId) {
            state.selectedDocProjectId = projectId;
            activateTab('documentation', true);
        } else if (action === 'add-project') {
            addProject();
        } else if (action === 'remove-project') {
            removeProject(idx);
        } else if (action === 'move-project') {
            moveProject(idx, delta);
        } else if (action === 'duplicate-project') {
            var source = state.data.projects[idx];
            if (source) {
                var dup = clone(source);
                delete dup.id;
                dup.title = (source.title || 'Project') + ' (Copy)';
                addProject(dup);
            }
        } else if (action === 'add-doc') {
            var targetProj = state.data.projects.find(function (p) { return String(p.id) === String(projectId); });
            if (targetProj) {
                var secs = Array.isArray(targetProj.documentation) ? targetProj.documentation.slice() : [];
                secs.push({ heading: 'New Section ' + (secs.length + 1), body: 'Documentation content goes here.' });
                saveDocumentation(projectId, secs);
            }
        } else if (action === 'remove-doc') {
            var pRem = state.data.projects.find(function (p) { return String(p.id) === String(projectId); });
            if (pRem && Array.isArray(pRem.documentation)) {
                var sRem = pRem.documentation.slice();
                sRem.splice(idx, 1);
                saveDocumentation(projectId, sRem);
            }
        } else if (action === 'move-doc') {
            var pMov = state.data.projects.find(function (p) { return String(p.id) === String(projectId); });
            if (pMov && Array.isArray(pMov.documentation)) {
                var sMov = pMov.documentation.slice();
                arrayMove(sMov, idx, delta);
                saveDocumentation(projectId, sMov);
            }
        } else if (action === 'add-lang') {
            addLanguage();
        } else if (action === 'remove-lang') {
            removeLanguage(idx);
        } else if (action === 'move-lang') {
            var expLang = normalizeExperience(state.data.experience);
            arrayMove(expLang.languages, idx, delta);
            persistDataset('experience', expLang, 'Reordered skills.');
            renderDialogBody();
        } else if (action === 'add-tool') {
            addTool();
        } else if (action === 'remove-tool') {
            removeTool(idx);
        } else if (action === 'move-tool') {
            var expTool = normalizeExperience(state.data.experience);
            arrayMove(expTool.tools, idx, delta);
            persistDataset('experience', expTool, 'Reordered tools.');
            renderDialogBody();
        } else if (action === 'add-sort-option') {
            addSortOption();
        } else if (action === 'remove-sort-option') {
            removeSortOption(idx);
        } else if (action === 'move-sort-option') {
            moveSortOption(idx, delta);
        } else if (action === 'add-timeline') {
            addTimelineItem();
        } else if (action === 'remove-timeline') {
            removeTimelineItem(idx);
        } else if (action === 'move-timeline') {
            var expTime = normalizeExperience(state.data.experience);
            arrayMove(expTime.timeline, idx, delta);
            persistDataset('experience', expTime, 'Reordered timeline entries.');
            renderDialogBody();
        } else if (action === 'add-social-channel') {
            if (btn.form) {
                state.data.socials = collectSocialsFromForm(btn.form);
            }
            addSocialChannel('', '');
        } else if (action === 'remove-social-channel') {
            var rowEl = btn.closest && btn.closest('.admin-social-custom-row');
            var keyInput = rowEl && rowEl.querySelector('input[name^="customSocialKey_"]');
            var socialKey = (keyInput && String(keyInput.value || '').trim()) || btn.getAttribute('data-social-key');
            if (btn.form) {
                state.data.socials = collectSocialsFromForm(btn.form);
            }
            removeSocialChannel(socialKey);
        } else if (action === 'add-home-action') {
            updatePages(function (pages) {
                pages.home = pages.home || {};
                pages.home.hero = pages.home.hero || {};
                pages.home.hero.actions = Array.isArray(pages.home.hero.actions) ? pages.home.hero.actions : [];
                pages.home.hero.actions.push({ label: 'New Action', href: 'projects.html', variant: 'button button-secondary' });
                return pages;
            });
        } else if (action === 'remove-home-action') {
            updatePages(function (pages) {
                var actions = pages.home && pages.home.hero && pages.home.hero.actions;
                if (Array.isArray(actions)) actions.splice(idx, 1);
                return pages;
            });
        } else if (action === 'sync-all-disk') {
            syncAllToDisk();
        } else if (action === 'link-folder') {
            linkProjectDirectory();
        } else if (action === 'toggle-password-form') {
            var dialog = getDialog();
            var drawer = dialog && dialog.querySelector('[data-admin-password-drawer]');
            if (drawer) {
                state.passwordDrawerOpen = !state.passwordDrawerOpen;
                drawer.hidden = !state.passwordDrawerOpen;
                var errEl = drawer.querySelector('[data-admin-change-pw-error]');
                if (errEl) {
                    errEl.textContent = '';
                    errEl.hidden = true;
                }
                if (state.passwordDrawerOpen) {
                    var curInput = drawer.querySelector('input[name="currentPassword"]');
                    if (curInput && typeof curInput.focus === 'function') curInput.focus();
                } else {
                    var pwForm = drawer.querySelector('form');
                    if (pwForm && typeof pwForm.reset === 'function') pwForm.reset();
                }
            }
        } else if (action === 'lock-admin') {
            lock();
        } else if (action === 'reset-dataset' && dataset) {
            resetDataset(dataset);
        } else if (action === 'reset-all') {
            resetAll();
        }
    }

    function handleDialogChange(e) {
        if (e.target.matches('[data-admin-select="doc-project"]')) {
            state.selectedDocProjectId = e.target.value;
            renderDialogBody();
        }
    }

    function handleDialogSubmit(e) {
        var form = e.target.closest('[data-admin-form]');
        if (!form) return;
        e.preventDefault();
        var type = form.getAttribute('data-admin-form');
        var fd = new FormData(form);
        var idx = parseInt(form.getAttribute('data-index'), 10);

        if (type === 'project') {
            var current = state.data.projects[idx] || {};
            var existingLinks = current.links || {};
            var nextLinks = Object.assign({}, existingLinks, {
                repo: String(fd.get('repo') || '').trim(),
                github: String(fd.get('repo') || '').trim(),
                live: String(fd.get('live') || '').trim(),
                docs: String(fd.get('docs') || '').trim()
            });
            var repoVal = nextLinks.repo;
            if (!repoVal) { delete nextLinks.repo; delete nextLinks.github; }
            if (!nextLinks.live) delete nextLinks.live;
            if (!nextLinks.docs) delete nextLinks.docs;

            updateProject(idx, {
                id: String(fd.get('id') || current.id || '').trim(),
                title: String(fd.get('title') || '').trim(),
                status: String(fd.get('status') || '').trim(),
                featured: form.querySelector('input[name="featured"]').checked,
                summary: String(fd.get('summary') || ''),
                description: String(fd.get('description') || ''),
                image: String(fd.get('image') || '').trim(),
                imageAlt: String(fd.get('imageAlt') || '').trim(),
                tech: parseCommaList(fd.get('tech')),
                tags: parseCommaList(fd.get('tags')),
                highlights: parseLineList(fd.get('highlights')),
                metrics: parseMetricsText(fd.get('metrics')),
                links: nextLinks,
                demo: {
                    url: String(fd.get('demoUrl') || '').trim(),
                    instructions: String(fd.get('demoInstructions') || '').trim()
                }
            });
        } else if (type === 'doc-section') {
            var pid = form.getAttribute('data-project-id');
            var proj = state.data.projects.find(function (p) { return String(p.id) === String(pid); });
            if (proj) {
                var sections = Array.isArray(proj.documentation) ? proj.documentation.slice() : [];
                sections[idx] = {
                    heading: String(fd.get('heading') || '').trim(),
                    body: String(fd.get('body') || '')
                };
                saveDocumentation(pid, sections);
            }
        } else if (type === 'language') {
            var expL = normalizeExperience(state.data.experience);
            expL.languages[idx] = Object.assign({}, expL.languages[idx], {
                name: String(fd.get('name') || '').trim(),
                icon: String(fd.get('icon') || '').trim(),
                level: String(fd.get('level') || '').trim()
            });
            persistDataset('experience', expL, 'Saved skill "' + expL.languages[idx].name + '".');
            renderDialogBody();
        } else if (type === 'tool') {
            var expT = normalizeExperience(state.data.experience);
            expT.tools[idx] = Object.assign({}, expT.tools[idx], {
                name: String(fd.get('name') || '').trim(),
                icon: String(fd.get('icon') || '').trim(),
                level: String(fd.get('level') || '').trim(),
                summary: String(fd.get('summary') || '').trim(),
                description: String(fd.get('description') || '').trim()
            });
            persistDataset('experience', expT, 'Saved tool "' + expT.tools[idx].name + '".');
            renderDialogBody();
        } else if (type === 'sort-option') {
            updateSortOption(idx, {
                label: String(fd.get('label') || '').trim(),
                by: String(fd.get('by') || 'language').trim(),
                target: String(fd.get('target') || '').trim()
            });
        } else if (type === 'timeline') {
            var expTm = normalizeExperience(state.data.experience);
            expTm.timeline[idx] = Object.assign({}, expTm.timeline[idx], {
                id: String(fd.get('id') || '').trim(),
                year: String(fd.get('year') || '').trim(),
                date: String(fd.get('date') || '').trim(),
                title: String(fd.get('title') || '').trim(),
                subtitle: String(fd.get('subtitle') || '').trim(),
                description: String(fd.get('description') || '').trim(),
                tags: parseCommaList(fd.get('tags'))
            });
            persistDataset('experience', expTm, 'Saved milestone "' + expTm.timeline[idx].title + '".');
            renderDialogBody();
        } else if (type === 'socials') {
            updateSocials(collectSocialsFromForm(form));
        } else if (type === 'pages') {
            updatePages(function (pages) {
                pages.home = pages.home || {};
                pages.home.hero = Object.assign({}, pages.home.hero, {
                    eyebrow: String(fd.get('homeEyebrow') || ''),
                    title: String(fd.get('homeTitle') || ''),
                    lead: String(fd.get('homeLead') || ''),
                    ctaNote: String(fd.get('homeCtaNote') || '')
                });
                if (Array.isArray(pages.home.hero.actions)) {
                    pages.home.hero.actions = pages.home.hero.actions.map(function (act, i) {
                        return Object.assign({}, act, {
                            label: String(fd.get('homeActionLabel_' + i) || act.label || ''),
                            href: String(fd.get('homeActionHref_' + i) || act.href || ''),
                            variant: String(fd.get('homeActionVariant_' + i) || act.variant || '')
                        });
                    });
                }
                pages.about = pages.about || {};
                pages.about.profile = Object.assign({}, pages.about.profile, {
                    name: String(fd.get('aboutName') || ''),
                    role: String(fd.get('aboutRole') || ''),
                    location: String(fd.get('aboutLocation') || ''),
                    summary: String(fd.get('aboutSummary') || ''),
                    bio: parseLineList(fd.get('aboutBio')),
                    goals: parseLineList(fd.get('aboutGoals')),
                    traits: parseLineList(fd.get('aboutTraits'))
                });
                pages.projects = pages.projects || {};
                pages.projects.hero = Object.assign({}, pages.projects.hero, {
                    eyebrow: String(fd.get('projectsEyebrow') || ''),
                    title: String(fd.get('projectsTitle') || ''),
                    lead: String(fd.get('projectsLead') || '')
                });
                pages.projects.featured = Object.assign({}, pages.projects.featured, {
                    tag: String(fd.get('featuredTag') || ''),
                    title: String(fd.get('featuredTitle') || '')
                });
                pages.contact = pages.contact || {};
                var targetContact = pages.contact.hero ? pages.contact.hero : pages.contact;
                targetContact.eyebrow = String(fd.get('contactEyebrow') || '');
                targetContact.title = String(fd.get('contactTitle') || '');
                targetContact.lead = String(fd.get('contactLead') || '');
                return pages;
            });
        } else if (type === 'change-password') {
            var curPw = String(fd.get('currentPassword') || '');
            var newPw = String(fd.get('newPassword') || '');
            var confirmPw = String(fd.get('confirmPassword') || '');
            if (typeof form.reset === 'function') form.reset();

            var pwErrEl = form.querySelector('[data-admin-change-pw-error]');
            var showPwError = function (msg) {
                if (pwErrEl) {
                    pwErrEl.textContent = msg;
                    pwErrEl.hidden = false;
                }
                setStatus(msg);
            };

            if (newPw !== confirmPw) {
                showPwError('New password and confirmation do not match.');
                return;
            }
            var res = changePassword(curPw, newPw);
            if (!res.ok) {
                showPwError(res.error || 'Could not update password.');
                return;
            }
            if (pwErrEl) {
                pwErrEl.textContent = '';
                pwErrEl.hidden = true;
            }
            state.passwordDrawerOpen = false;
            var drawerEl = form.closest('[data-admin-password-drawer]');
            if (drawerEl) drawerEl.hidden = true;
        }
    }

    /* ------------------------------------------------------------- Open / Close / Lock / Toggle */
    function isOpen() {
        var dialog = getDialog();
        return Boolean(dialog && dialog.open);
    }

    function open(initialTab) {
        if (initialTab && TABS.some(function (t) { return t.key === initialTab; })) {
            state.activeTab = initialTab;
        }

        if (!state.authenticated) {
            state.pendingTab = state.activeTab;
            var authDialog = ensureAuthDialog();
            if (!authDialog) return Promise.resolve(false);
            if (!authDialog.open) {
                if (typeof authDialog.showModal === 'function') {
                    authDialog.showModal();
                } else {
                    authDialog.setAttribute('open', '');
                    authDialog.open = true;
                }
            }
            var pwField = authDialog.querySelector('input[name="adminPassword"]');
            if (pwField && typeof pwField.focus === 'function') {
                pwField.focus();
            }
            return Promise.resolve(false);
        }

        var dialog = ensureDialog();
        if (!dialog) return Promise.resolve(false);

        return loadAllData(false).then(function () {
            activateTab(state.activeTab || 'projects', false);
            if (!dialog.open) {
                if (typeof dialog.showModal === 'function') {
                    dialog.showModal();
                } else {
                    dialog.setAttribute('open', '');
                    dialog.open = true;
                }
            }
            return true;
        });
    }

    function close() {
        var dialog = getDialog();
        if (!dialog || !dialog.open) return false;
        if (typeof dialog.close === 'function') {
            dialog.close();
        } else {
            dialog.removeAttribute('open');
            dialog.open = false;
        }
        return true;
    }

    function lock() {
        state.authenticated = false;
        state.passwordDrawerOpen = false;
        state.pendingTab = null;
        removeAuthDialog();
        var dialog = getDialog();
        if (dialog) {
            if (dialog.open && typeof dialog.close === 'function') {
                dialog.close();
            }
            dialog.remove();
        }
        return true;
    }

    function toggle(initialTab) {
        if (isOpen()) {
            close();
            return Promise.resolve(false);
        }
        return open(initialTab);
    }

    /* ------------------------------------------------------------- Brand Hold Gesture */
    function cancelHold() {
        if (gesture.timer) {
            clearTimeout(gesture.timer);
            gesture.timer = null;
        }
        if (gesture.holdingBrand) {
            gesture.holdingBrand.classList.remove('is-holding');
            gesture.holdingBrand = null;
        }
        gesture.pointerId = null;
    }

    function completeHold(brand) {
        cancelHold();
        gesture.suppressNextBrandClick = true;
        clearTimeout(gesture.suppressClickTimer);
        gesture.suppressClickTimer = setTimeout(function () {
            gesture.suppressNextBrandClick = false;
        }, 1200);

        if (brand) {
            brand.classList.add('is-unlocked');
            setTimeout(function () { brand.classList.remove('is-unlocked'); }, 600);
        }
        toggle();
    }

    function startHold(brand, pointerId, clientX, clientY) {
        cancelHold();
        gesture.holdingBrand = brand;
        gesture.pointerId = pointerId;
        gesture.startX = clientX || 0;
        gesture.startY = clientY || 0;
        brand.classList.add('is-holding');
        gesture.timer = setTimeout(function () {
            completeHold(brand);
        }, HOLD_DURATION_MS);
    }

    function initHoldGesture() {
        if (typeof document === 'undefined' || gesture.initialized) return;
        gesture.initialized = true;

        document.addEventListener('pointerdown', function (e) {
            if (e.button !== undefined && e.button !== 0) return;
            var target = e.target && e.target.closest ? e.target.closest('.brand') : null;
            if (!target) return;
            startHold(target, e.pointerId, e.clientX, e.clientY);
        });

        document.addEventListener('pointermove', function (e) {
            if (!gesture.holdingBrand || !gesture.timer) return;
            var dx = (e.clientX || 0) - gesture.startX;
            var dy = (e.clientY || 0) - gesture.startY;
            if (Math.hypot(dx, dy) > 14) {
                cancelHold();
            }
        });

        document.addEventListener('pointerup', cancelHold);
        document.addEventListener('pointercancel', cancelHold);
        document.addEventListener('pointerleave', function (e) {
            if (gesture.holdingBrand && e.target === gesture.holdingBrand) {
                cancelHold();
            }
        }, true);

        document.addEventListener('contextmenu', function (e) {
            if (gesture.holdingBrand && e.target && e.target.closest && e.target.closest('.brand')) {
                e.preventDefault();
            }
        });

        document.addEventListener('click', function (e) {
            var brand = e.target && e.target.closest ? e.target.closest('.brand') : null;
            if (!brand) return;
            if (gesture.suppressNextBrandClick) {
                e.preventDefault();
                e.stopPropagation();
                gesture.suppressNextBrandClick = false;
                clearTimeout(gesture.suppressClickTimer);
            }
        }, true);

        document.addEventListener('keydown', function (e) {
            if ((e.altKey || e.ctrlKey) && e.shiftKey && e.key && e.key.toLowerCase() === 'a') {
                e.preventDefault();
                toggle();
                return;
            }
            if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                var brand = e.target && e.target.closest ? e.target.closest('.brand') : null;
                if (brand) {
                    startHold(brand, 'keyboard', 0, 0);
                }
            }
        });

        document.addEventListener('keyup', function (e) {
            if ((e.key === ' ' || e.key === 'Enter') && gesture.pointerId === 'keyboard') {
                cancelHold();
            }
        });
    }

    initHoldGesture();

    var api = {
        HOLD_DURATION_MS: HOLD_DURATION_MS,
        DIALOG_ID: DIALOG_ID,
        open: open,
        close: close,
        lock: lock,
        toggle: toggle,
        isOpen: isOpen,
        isAuthenticated: isAuthenticated,
        verifyPassword: verifyPassword,
        changePassword: changePassword,
        loadAllData: loadAllData,
        getState: function () { return clone(state.data); },
        addProject: addProject,
        updateProject: updateProject,
        removeProject: removeProject,
        moveProject: moveProject,
        saveDocumentation: saveDocumentation,
        addLanguage: addLanguage,
        removeLanguage: removeLanguage,
        addSortOption: addSortOption,
        updateSortOption: updateSortOption,
        removeSortOption: removeSortOption,
        moveSortOption: moveSortOption,
        addTool: addTool,
        removeTool: removeTool,
        addTimelineItem: addTimelineItem,
        removeTimelineItem: removeTimelineItem,
        updateSocials: updateSocials,
        addSocialChannel: addSocialChannel,
        removeSocialChannel: removeSocialChannel,
        updatePages: updatePages,
        saveDatasetToDisk: saveDatasetToDisk,
        syncAllToDisk: syncAllToDisk,
        resetDataset: resetDataset,
        resetAll: resetAll
    };

    global.PortfolioAdmin = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
