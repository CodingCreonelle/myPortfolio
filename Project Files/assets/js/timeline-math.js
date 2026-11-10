/* =========================================================================
   PortfolioTimelineMath — Standalone Pure Mathematical & Geometric Kernel
   
   Milestone M4: Timeline Decomposition.
   Pure functional design with ZERO DOM or browser globals (window, document,
   navigator must NOT be required).
   Published via dual UMD / CommonJS export pattern.
   ========================================================================= */

/**
 * @typedef {Object} MonthYearResult
 * @property {number|null} year - Full calendar year (e.g. 2024), or null if invalid.
 * @property {number|null} month - 1-based calendar month index (1..12), or null if invalid.
 * @property {number|null} totalMonths - Cumulative monotonic index: year * 12 + month - 1, or null if invalid.
 * @property {boolean} isPresent - True if resolved from dynamic "Present" or "Current".
 * @property {boolean} isValid - True if date string was successfully parsed.
 * @property {number|null} [sortKey] - Monotonic numeric key for chronological sorting.
 * @property {string} [raw] - Original input string.
 */

/**
 * @typedef {Object} DateRangeResult
 * @property {MonthYearResult} start - Parsed start date.
 * @property {MonthYearResult} end - Parsed end date.
 * @property {number} durationMonths - Span between start and end in months (inclusive).
 * @property {boolean} isValid - True if both start and end dates are valid.
 * @property {boolean} [isCurrent] - True if end is marked current/present.
 * @property {string} [raw] - Original input range string.
 */

/**
 * @typedef {Object} NormalizedTimelineEntry
 * @property {string} [id] - Milestone ID.
 * @property {string} [title] - Milestone title.
 * @property {string} [subtitle] - Milestone subtitle.
 * @property {string} [description] - Milestone description.
 * @property {string[]} [tags] - Milestone tags.
 * @property {string} [date] - Raw date string.
 * @property {string|number} [year] - Year representation.
 * @property {any} [item] - Reference to original source item.
 * @property {number} [rawIndex] - Original index in source array.
 * @property {number} [index] - Chronological sorted index (0..N-1).
 * @property {number|null} startMonth - Monotonic start month count.
 * @property {number|null} endMonth - Monotonic end month count.
 * @property {number|null} totalMonths - Monotonic month count.
 * @property {number} durationMonths - Duration in months.
 * @property {number} startFraction - Normalized temporal position (0.0 to 1.0).
 * @property {number} endFraction - Normalized temporal position (0.0 to 1.0).
 * @property {number} durationFraction - Normalized duration fraction.
 * @property {number} timeNorm - Normalized temporal position (0.0 to 1.0).
 * @property {number} height - Unnormalized alternating cumulative height.
 * @property {number} rise - Mountain ridge climb normalized between 0.0 and 1.0.
 */

/**
 * @typedef {Object} RidgeHeightsResult
 * @property {number[]} heights - Cumulative alternating heights array.
 * @property {number} lowest - Minimum cumulative height.
 * @property {number} highest - Maximum cumulative height.
 * @property {number} span - Difference between highest and lowest height.
 * @property {number[]} rises - Normalized rise factors between 0.0 and 1.0.
 */

/**
 * @typedef {Object} SlopeOptions
 * @property {number} [run] - Horizontal run distance in pixels.
 * @property {number} [climbSpan] - Maximum vertical climb span in pixels.
 * @property {number} [entryWidth] - Entry card width in pixels.
 * @property {number} [trackGap] - Gap between entries in pixels.
 * @property {number} [lane] - Height of timeline lane in pixels.
 * @property {number} [orbSize] - Diameter of orb in pixels.
 */

/**
 * @typedef {Object} SlopeResult
 * @property {number} run - Horizontal run in pixels.
 * @property {number} climbSpan - Maximum vertical climb span.
 * @property {number} climb - Vertical climb delta in pixels: -(to - from) * climbSpan.
 * @property {number} slopeLength - Hypotenuse distance in pixels.
 * @property {number} length - Hypotenuse distance in pixels (alias for slopeLength).
 * @property {string} lengthPx - Formatted pixel length string (e.g. "124.50px").
 * @property {string} formattedLength - Formatted pixel length string.
 * @property {number} slopeAngle - Rotation angle in degrees (-180 to 180).
 * @property {number} angleDeg - Rotation angle in degrees (alias for slopeAngle).
 * @property {string} angleStr - Formatted degree string (e.g. "-15.200deg").
 * @property {string} formattedAngle - Formatted degree string.
 */

/**
 * @typedef {Object} RidgePoint
 * @property {number} index - Index of point.
 * @property {number} x - Pixel X coordinate.
 * @property {number} y - Pixel Y coordinate.
 * @property {number} normX - Normalized horizontal coordinate (0.0 to 1.0).
 * @property {number} normY - Normalized vertical coordinate / rise (0.0 to 1.0).
 * @property {number} rise - Normalized rise value.
 * @property {any} item - Source item reference.
 */

/**
 * @typedef {Object} RidgeSegment
 * @property {number} fromIndex - Index of starting point.
 * @property {number} toIndex - Index of ending point.
 * @property {RidgePoint} from - Starting point reference.
 * @property {RidgePoint} to - Ending point reference.
 * @property {number} dx - Horizontal run between points.
 * @property {number} dy - Vertical delta between points.
 * @property {number} length - Distance between points.
 * @property {number} angleDeg - Angle in degrees between points.
 * @property {number} slope - Geometric slope (dy / dx).
 */

/**
 * @typedef {Object} RidgeGeometryResult
 * @property {number} width - Canvas or container width.
 * @property {number} height - Canvas or container height.
 * @property {RidgePoint[]} points - Calculated coordinate vertices.
 * @property {RidgeSegment[]} segments - Connecting lines with slope measurements.
 * @property {string} path - SVG path commands for ridge trail ('M x y L x y...').
 * @property {string} svgPath - Alias for path.
 * @property {string} areaPath - SVG path commands for closed silhouette polygon.
 * @property {string} svgAreaPath - Alias for areaPath.
 * @property {SlopeResult[]} slopes - Connecting slope records between points.
 * @property {number[]} rises - Normalized rise values.
 * @property {{minX: number, maxX: number, minY: number, maxY: number, width: number, height: number}} bounds - Bounding box metrics.
 */

(function (global) {
    'use strict';

    /* ------------------------------------------------------------- Constants */
    var ISO_DATE_PATTERN = /^(\d{4})-(\d{1,2})$/;
    var YEAR_ONLY_PATTERN = /^(\d{4})$/;
    var MONTH_NAME_YEAR_PATTERN = /^([a-zA-Z]+)[,\s]+(\d{4})$/;
    var YEAR_MONTH_NAME_PATTERN = /^(\d{4})[,\s]+([a-zA-Z]+)$/;
    var CURRENT_PATTERN = /^(?:present|current|now)$/i;
    var RANGE_SPLIT_PATTERN = /\s+[-–—]\s+|\s+to\s+|\s*\/\s*|\s*[–—]\s*/i;

    /**
     * Immutable dictionary of 12 calendar month names and 3-letter abbreviations.
     * Maps lowercase month strings to 1-based month numbers (1..12).
     */
    var MONTH_NAMES = Object.freeze({
        january: 1, jan: 1,
        february: 2, feb: 2,
        march: 3, mar: 3,
        april: 4, apr: 4,
        may: 5,
        june: 6, jun: 6,
        july: 7, jul: 7,
        august: 8, aug: 8,
        september: 9, sep: 9, sept: 9,
        october: 10, oct: 10,
        november: 11, nov: 11,
        december: 12, dec: 12
    });

    /* ------------------------------------------------------------- Core Functions */

    /**
     * Parses an ISO date ("2024-02"), named month ("January 2024", "Feb 2024"),
     * single year ("2024"), or ongoing indicator ("Present", "Current") into
     * calendar and monotonic month indices.
     *
     * Pure function with zero DOM dependencies.
     *
     * @param {string|number|Object|null|undefined} dateStr - Raw date string, year number, or entry object.
     * @returns {MonthYearResult} Parsed date descriptor.
     */
    function parseMonthYear(dateStr) {
        var fallback = {
            year: null,
            month: null,
            totalMonths: null,
            isPresent: false,
            isValid: false
        };

        if (dateStr == null) return fallback;

        // If an entry object is passed, extract its date or year property
        if (typeof dateStr === 'object') {
            dateStr = dateStr.date || dateStr.year || '';
        }

        var raw = String(dateStr).trim();
        if (!raw) return fallback;

        // 1. "Present", "Current", "Now"
        if (CURRENT_PATTERN.test(raw)) {
            var now = new Date();
            var currYear = now.getFullYear();
            var currMonth = now.getMonth() + 1;
            var currTotal = currYear * 12 + currMonth - 1;
            return {
                year: currYear,
                month: currMonth,
                totalMonths: currTotal,
                sortKey: currTotal,
                isPresent: true,
                isValid: true,
                raw: raw
            };
        }

        // 2. ISO YYYY-MM
        var isoMatch = ISO_DATE_PATTERN.exec(raw);
        if (isoMatch) {
            var y = parseInt(isoMatch[1], 10);
            var m = parseInt(isoMatch[2], 10);
            if (m < 1 || m > 12) {
                return fallback;
            }
            var total = y * 12 + m - 1;
            return {
                year: y,
                month: m,
                totalMonths: total,
                sortKey: total,
                isPresent: false,
                isValid: true,
                raw: raw
            };
        }

        // 3. Month Name + Year ("February 2024", "Feb 2024", "August, 2025")
        var myMatch = MONTH_NAME_YEAR_PATTERN.exec(raw);
        if (myMatch) {
            var monthName = myMatch[1].toLowerCase();
            var yearNum = parseInt(myMatch[2], 10);
            var monthNum = MONTH_NAMES[monthName];
            if (monthNum) {
                var totalMy = yearNum * 12 + monthNum - 1;
                return {
                    year: yearNum,
                    month: monthNum,
                    totalMonths: totalMy,
                    sortKey: totalMy,
                    isPresent: false,
                    isValid: true,
                    raw: raw
                };
            }
        }

        // 4. Year + Month Name ("2024 February")
        var ymMatch = YEAR_MONTH_NAME_PATTERN.exec(raw);
        if (ymMatch) {
            var yNum = parseInt(ymMatch[1], 10);
            var mName = ymMatch[2].toLowerCase();
            var mNum = MONTH_NAMES[mName];
            if (mNum) {
                var totalYm = yNum * 12 + mNum - 1;
                return {
                    year: yNum,
                    month: mNum,
                    totalMonths: totalYm,
                    sortKey: totalYm,
                    isPresent: false,
                    isValid: true,
                    raw: raw
                };
            }
        }

        // 5. Single Year ("2024")
        var yearMatch = YEAR_ONLY_PATTERN.exec(raw);
        if (yearMatch) {
            var yr = parseInt(yearMatch[1], 10);
            var totalYr = yr * 12; // Month 1 (January): yr * 12 + 1 - 1
            return {
                year: yr,
                month: 1,
                totalMonths: totalYr,
                sortKey: totalYr,
                isPresent: false,
                isValid: true,
                raw: raw
            };
        }

        return fallback;
    }

    /**
     * Parses a date range string ("2024-02 - 2024-09", "Jan 2020 - Present", "2021 to Current")
     * into structured start and end date objects with total duration in months.
     *
     * @param {string|null|undefined} rangeStr - Date range string.
     * @returns {DateRangeResult} Range descriptor.
     */
    function parseDateRange(rangeStr) {
        var fallback = {
            start: { year: null, month: null, totalMonths: null, isPresent: false, isValid: false },
            end: { year: null, month: null, totalMonths: null, isPresent: false, isValid: false },
            durationMonths: 0,
            isValid: false
        };

        if (rangeStr == null) return fallback;
        var raw = String(rangeStr).trim();
        if (!raw) return fallback;

        var parts = raw.split(RANGE_SPLIT_PATTERN);
        if (parts.length >= 2) {
            var start = parseMonthYear(parts[0]);
            var end = parseMonthYear(parts[1]);
            var valid = Boolean(start && start.isValid && end && end.isValid);
            var duration = 0;
            if (valid) {
                if (end.totalMonths > start.totalMonths) {
                    duration = end.totalMonths - start.totalMonths;
                } else if (end.totalMonths === start.totalMonths) {
                    duration = 1;
                } else {
                    duration = Math.max(1, start.totalMonths - end.totalMonths);
                }
            }
            return {
                start: start,
                end: end,
                durationMonths: duration,
                isValid: valid,
                isCurrent: Boolean(end && end.isPresent),
                raw: raw
            };
        }

        var single = parseMonthYear(raw);
        var singleValid = Boolean(single && single.isValid);
        return {
            start: single,
            end: single,
            durationMonths: singleValid ? 1 : 0,
            isValid: singleValid,
            isCurrent: Boolean(single && single.isPresent),
            raw: raw
        };
    }

    /**
     * Month index for a timeline entry, or null when it has no usable date.
     * Direct replacement for entryMonth in timeline.js.
     *
     * @param {any} entry - Timeline entry object.
     * @returns {number|null} Total monotonic months or null.
     */
    function entryMonth(entry) {
        if (!entry) return null;
        var parsed = parseMonthYear(entry.date || entry.year || '');
        return parsed && parsed.isValid ? parsed.totalMonths : null;
    }

    /**
     * Displayed year string, extracted from date so label and climb stay synchronized.
     * Direct replacement for entryYear in timeline.js.
     *
     * @param {any} entry - Timeline entry object.
     * @returns {string} 4-digit year string or fallback.
     */
    function entryYear(entry) {
        if (!entry) return '';
        var parsed = parseMonthYear(entry.date || entry.year || '');
        if (parsed && parsed.isValid && parsed.year !== null) {
            return String(parsed.year);
        }
        return entry.year ? String(entry.year) : '';
    }

    /**
     * Computes cumulative alternating heights and normalized rise factors (0.0 to 1.0)
     * for an array of timeline items.
     *
     * @param {Array<any>} timeline - Timeline entries array.
     * @returns {RidgeHeightsResult} Heights and normalized rise values.
     */
    function computeRidgeHeights(timeline) {
        if (!Array.isArray(timeline) || !timeline.length) {
            return { heights: [], lowest: 0, highest: 0, span: 0, rises: [] };
        }

        var months = timeline.map(entryMonth);
        var heights = [0];

        for (var index = 1; index < months.length; index += 1) {
            var previous = months[index - 1];
            var current = months[index];
            var gap = previous === null || current === null ? 0 : Math.abs(current - previous);
            heights.push(heights[index - 1] + (index % 2 === 1 ? gap : -gap));
        }

        var lowest = Math.min.apply(null, heights);
        var highest = Math.max.apply(null, heights);
        var span = highest - lowest;

        var rises = heights.map(function (h) {
            return span > 0 ? (h - lowest) / span : 0;
        });

        return {
            heights: heights,
            lowest: lowest,
            highest: highest,
            span: span,
            rises: rises
        };
    }

    /**
     * Normalizes and enriches timeline entries.
     * Sorts entries chronologically (unless options.preserveOrder is set), computes
     * normalized temporal coordinates (0.0 to 1.0), and derives alternating mountain
     * heights and normalized rise values.
     *
     * @param {Array<any>} items - Timeline items array.
     * @param {Object} [options] - Optional sorting controls.
     * @param {boolean} [options.preserveOrder=false] - When true, preserves input order.
     * @returns {NormalizedTimelineEntry[]} Array of normalized timeline records.
     */
    function calculateNorms(items, options) {
        if (!Array.isArray(items) || !items.length) return [];
        var opts = options || {};

        var mapped = items.map(function (item, rawIndex) {
            var dateStr = (item && (item.date || item.year || item.dateRange || item.period)) || '';
            var parsed = parseMonthYear(dateStr);
            return {
                rawIndex: rawIndex,
                item: item,
                parsed: parsed,
                totalMonths: parsed && parsed.isValid ? parsed.totalMonths : null
            };
        });

        var sorted;
        if (opts.preserveOrder) {
            sorted = mapped.slice();
        } else {
            sorted = mapped.slice().sort(function (a, b) {
                if (a.totalMonths === null && b.totalMonths === null) return a.rawIndex - b.rawIndex;
                if (a.totalMonths === null) return 1;
                if (b.totalMonths === null) return -1;
                if (a.totalMonths !== b.totalMonths) return a.totalMonths - b.totalMonths;
                return a.rawIndex - b.rawIndex;
            });
        }

        var validMonths = sorted
            .map(function (entry) { return entry.totalMonths; })
            .filter(function (m) { return m !== null; });

        var minMonth = validMonths.length ? Math.min.apply(null, validMonths) : 0;
        var maxMonth = validMonths.length ? Math.max.apply(null, validMonths) : 0;
        var monthSpan = maxMonth - minMonth;

        var heights = [0];
        for (var i = 1; i < sorted.length; i += 1) {
            var prev = sorted[i - 1].totalMonths;
            var curr = sorted[i].totalMonths;
            var gap = (prev === null || curr === null) ? 0 : Math.abs(curr - prev);
            var step = (i % 2 === 1) ? gap : -gap;
            heights.push(heights[i - 1] + step);
        }

        var lowest = Math.min.apply(null, heights);
        var highest = Math.max.apply(null, heights);
        var heightSpan = highest - lowest;

        return sorted.map(function (entry, index) {
            var tNorm = (monthSpan > 0 && entry.totalMonths !== null)
                ? (entry.totalMonths - minMonth) / monthSpan
                : 0.0;
            var rNorm = heightSpan > 0
                ? (heights[index] - lowest) / heightSpan
                : 0.0;

            var baseItem = entry.item || {};
            var result = Object.assign({}, baseItem, {
                id: baseItem.id,
                title: baseItem.title,
                subtitle: baseItem.subtitle,
                description: baseItem.description,
                tags: baseItem.tags,
                date: baseItem.date,
                year: baseItem.year,
                item: entry.item,
                rawIndex: entry.rawIndex,
                index: index,
                startMonth: entry.totalMonths,
                endMonth: entry.totalMonths,
                totalMonths: entry.totalMonths,
                durationMonths: 1,
                startFraction: Number(tNorm.toFixed(6)),
                endFraction: Number(tNorm.toFixed(6)),
                durationFraction: sorted.length === 1 ? 1.0 : (monthSpan > 0 ? 0.0 : 1.0),
                timeNorm: Number(tNorm.toFixed(6)),
                height: heights[index],
                rise: Number(rNorm.toFixed(6))
            });

            return result;
        });
    }

    /**
     * Computes the hypotenuse distance and rotation angle between two orb rises.
     * Supports both signature styles:
     * - `computeSlope(fromRise, toRise, options)`
     * - `computeSlope(run, climbSpan, fromRise, toRise)`
     *
     * @param {number} arg0 - fromRise (or run)
     * @param {number} arg1 - toRise (or climbSpan)
     * @param {SlopeOptions|number} [arg2] - options object (or fromRise)
     * @param {number} [arg3] - toRise (when 4 numeric arguments are passed)
     * @returns {SlopeResult} Computed slope metrics.
     */
    function computeSlope(arg0, arg1, arg2, arg3) {
        var run = 0;
        var climbSpan = 0;
        var from = 0;
        var to = 0;

        if (typeof arg2 === 'number' && typeof arg3 === 'number') {
            // Signature: computeSlope(run, climbSpan, from, to)
            run = Number(arg0) || 0;
            climbSpan = Number(arg1) || 0;
            from = Number(arg2) || 0;
            to = Number(arg3) || 0;
        } else {
            // Signature: computeSlope(fromRise, toRise, options)
            from = Number(arg0) || 0;
            to = Number(arg1) || 0;
            var opts = arg2 || {};
            if (opts.run != null) {
                run = Number(opts.run) || 0;
            } else if (opts.entryWidth != null || opts.trackGap != null) {
                run = (Number(opts.entryWidth) || 0) + (Number(opts.trackGap) || 0);
            }
            if (opts.climbSpan != null) {
                climbSpan = Number(opts.climbSpan) || 0;
            } else if (opts.lane != null || opts.orbSize != null) {
                climbSpan = (Number(opts.lane) || 0) - (Number(opts.orbSize) || 0);
            }
        }

        // Screen Y grows downward: climbing up to a higher orb is a negative delta
        var climb = -(to - from) * climbSpan;
        var length = Math.hypot ? Math.hypot(run, climb) : Math.sqrt(run * run + climb * climb);
        var angleDeg = (Math.atan2(climb, run) * 180) / Math.PI;

        var roundedClimb = Number(climb.toFixed(4));
        var roundedLength = Number(length.toFixed(2));
        var roundedAngle = Number(angleDeg.toFixed(3));
        var lengthStr = length.toFixed(2) + 'px';
        var angleStr = angleDeg.toFixed(3) + 'deg';

        return {
            run: run,
            climbSpan: climbSpan,
            climb: roundedClimb,
            slopeLength: roundedLength,
            length: roundedLength,
            lengthPx: lengthStr,
            formattedLength: lengthStr,
            slopeAngle: roundedAngle,
            angleDeg: roundedAngle,
            angleStr: angleStr,
            formattedAngle: angleStr
        };
    }

    /**
     * Computes slope records for an array of normalized rises.
     *
     * @param {number[]} rises - Array of rise values.
     * @param {SlopeOptions} options - Layout dimensions.
     * @returns {SlopeResult[]} Array of slope records.
     */
    function computeSlopes(rises, options) {
        if (!Array.isArray(rises) || rises.length < 2) return [];
        var slopes = [];
        for (var i = 0; i < rises.length - 1; i += 1) {
            slopes.push(computeSlope(rises[i], rises[i + 1], options));
        }
        return slopes;
    }

    /**
     * Computes 2D mountain ridge coordinates, connecting slopes, and SVG path strings.
     *
     * @param {Array<any>} items - Source items or normalized items.
     * @param {number} width - Container pixel width.
     * @param {number} height - Container pixel height.
     * @param {Object} [options] - Geometry options.
     * @returns {RidgeGeometryResult} Geometry and SVG path result.
     */
    function computeRidgeGeometry(items, width, height, options) {
        var safeW = Math.max(0, Number(width) || 0);
        var safeH = Math.max(0, Number(height) || 0);

        var emptyBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0, width: safeW, height: safeH };
        if (!Array.isArray(items) || !items.length || safeW === 0 || safeH === 0) {
            return {
                width: safeW,
                height: safeH,
                points: [],
                segments: [],
                path: '',
                svgPath: '',
                areaPath: '',
                svgAreaPath: '',
                slopes: [],
                rises: [],
                bounds: emptyBounds
            };
        }

        var opts = options || {};
        var pad = typeof opts.padding === 'number'
            ? { top: opts.padding, right: opts.padding, bottom: opts.padding, left: opts.padding }
            : Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, opts.padding || {});

        var orbSize = Number(opts.orbSize) || 0;
        var availableW = Math.max(1, safeW - pad.left - pad.right);
        var availableH = Math.max(1, safeH - pad.top - pad.bottom - orbSize);

        var norms = (items[0] && typeof items[0].rise === 'number')
            ? items
            : calculateNorms(items, { preserveOrder: opts.preserveOrder });

        var count = norms.length;
        var points = [];
        var entryW = Number(opts.entryWidth) || 0;
        var trackGap = Number(opts.trackGap) || 0;
        var hasFixedStep = entryW > 0 && trackGap > 0;

        for (var i = 0; i < count; i += 1) {
            var norm = norms[i];
            var normX = count > 1 ? i / (count - 1) : 0.5;
            var x;
            if (hasFixedStep) {
                x = pad.left + i * (entryW + trackGap) + entryW / 2;
            } else {
                x = pad.left + normX * availableW;
            }

            var normY = norm.rise != null ? norm.rise : 0;
            // Screen Y grows downward: rise = 1 is highest peak
            var y = (safeH - pad.bottom - orbSize / 2) - (normY * availableH);

            points.push({
                index: i,
                x: Number(x.toFixed(2)),
                y: Number(y.toFixed(2)),
                normX: Number(normX.toFixed(4)),
                normY: Number(normY.toFixed(4)),
                rise: normY,
                item: norm.item || norm
            });
        }

        var segments = [];
        for (var s = 0; s < points.length - 1; s += 1) {
            var pFrom = points[s];
            var pTo = points[s + 1];
            var dx = pTo.x - pFrom.x;
            var dy = pTo.y - pFrom.y;
            var segLen = Math.hypot ? Math.hypot(dx, dy) : Math.sqrt(dx * dx + dy * dy);
            var angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            var slope = dx !== 0 ? dy / dx : 0;

            segments.push({
                fromIndex: s,
                toIndex: s + 1,
                from: pFrom,
                to: pTo,
                dx: Number(dx.toFixed(2)),
                dy: Number(dy.toFixed(2)),
                length: Number(segLen.toFixed(2)),
                angleDeg: Number(angle.toFixed(3)),
                slope: Number(slope.toFixed(4))
            });
        }

        var path = '';
        var areaPath = '';
        if (points.length) {
            path = 'M ' + points[0].x.toFixed(2) + ' ' + points[0].y.toFixed(2);
            for (var p = 1; p < points.length; p += 1) {
                path += ' L ' + points[p].x.toFixed(2) + ' ' + points[p].y.toFixed(2);
            }

            var floorY = (safeH - pad.bottom).toFixed(2);
            var firstX = points[0].x.toFixed(2);
            var lastX = points[points.length - 1].x.toFixed(2);
            areaPath = path + ' L ' + lastX + ' ' + floorY + ' L ' + firstX + ' ' + floorY + ' Z';
        }

        var xs = points.map(function (pt) { return pt.x; });
        var ys = points.map(function (pt) { return pt.y; });
        var minX = Math.min.apply(null, xs);
        var maxX = Math.max.apply(null, xs);
        var minY = Math.min.apply(null, ys);
        var maxY = Math.max.apply(null, ys);

        var rises = points.map(function (pt) { return pt.rise; });
        var slopeOpts = {
            run: hasFixedStep ? (entryW + trackGap) : (availableW / (count > 1 ? count - 1 : 1)),
            climbSpan: availableH
        };
        var slopes = computeSlopes(rises, slopeOpts);

        return {
            width: safeW,
            height: safeH,
            points: points,
            segments: segments,
            path: path,
            svgPath: path,
            areaPath: areaPath,
            svgAreaPath: areaPath,
            slopes: slopes,
            rises: rises,
            bounds: {
                minX: minX,
                maxX: maxX,
                minY: minY,
                maxY: maxY,
                width: Number((maxX - minX).toFixed(2)),
                height: Number((maxY - minY).toFixed(2))
            }
        };
    }

    /* ------------------------------------------------------------- Scroll & Centering Helpers */

    /**
     * Calculates the distance needed for sticky pinned scrolling.
     *
     * @param {number} scrollSpan - Total scroll width minus client width.
     * @param {number} travelRatio - Travel multiplier from CSS variable.
     * @returns {number} Required pinned scroll travel distance in pixels.
     */
    function calculatePinDistance(scrollSpan, travelRatio) {
        if (!Number.isFinite(travelRatio) || travelRatio <= 0 || !Number.isFinite(scrollSpan) || scrollSpan <= 0) {
            return 0;
        }
        return scrollSpan * travelRatio;
    }

    /**
     * Computes the normalized scroll progress between 0.0 and 1.0.
     *
     * @param {number} pinOffset - Sticky pin top offset.
     * @param {number} runwayTop - Top offset of runway bounding rect.
     * @param {number} runwayHeight - Height of runway element.
     * @param {number} pinHeight - Height of pin element.
     * @returns {number} Normalized progress in [0, 1].
     */
    function calculatePinProgress(pinOffset, runwayTop, runwayHeight, pinHeight) {
        var travel = runwayHeight - pinHeight;
        if (travel <= 0) return 0;
        var scrolled = pinOffset - runwayTop;
        return Math.min(1, Math.max(0, scrolled / travel));
    }

    /**
     * Maps scroll progress onto the track's scrollLeft coordinate.
     *
     * @param {number} progress - Normalized progress in [0, 1].
     * @param {number} scrollWidth - Total track scroll width.
     * @param {number} clientWidth - Visible track client width.
     * @returns {number} Horizontal scroll offset in pixels.
     */
    function calculateScrollOffset(progress, scrollWidth, clientWidth) {
        return Math.max(0, progress) * Math.max(0, scrollWidth - clientWidth);
    }

    /**
     * Finds the index of the entry whose center coordinate is nearest to the track center.
     *
     * @param {number} trackCenter - Center X coordinate of track container.
     * @param {number[]} entryCenters - Center X coordinates of each entry.
     * @returns {number} Nearest entry index, or -1 if empty.
     */
    function findNearestEntryIndex(trackCenter, entryCenters) {
        if (!Array.isArray(entryCenters) || !entryCenters.length) return -1;
        var nearestIndex = -1;
        var nearestDistance = Infinity;
        for (var i = 0; i < entryCenters.length; i += 1) {
            var dist = Math.abs(entryCenters[i] - trackCenter);
            if (dist < nearestDistance) {
                nearestDistance = dist;
                nearestIndex = i;
            }
        }
        return nearestIndex;
    }

    /**
     * Clamps an index within [0, count - 1].
     *
     * @param {number} index - Desired index.
     * @param {number} count - Total item count.
     * @returns {number} Clamped index.
     */
    function clampIndex(index, count) {
        if (count <= 0) return 0;
        return Math.max(0, Math.min(count - 1, index));
    }

    /**
     * Calculates the track scroll target to center a specific entry.
     *
     * @param {number} entryLeft - Entry element offsetLeft.
     * @param {number} entryWidth - Entry element offsetWidth.
     * @param {number} trackClientWidth - Track container clientWidth.
     * @returns {number} Target scrollLeft in pixels.
     */
    function calculateTrackScrollTarget(entryLeft, entryWidth, trackClientWidth) {
        return entryLeft + entryWidth / 2 - trackClientWidth / 2;
    }

    /**
     * Calculates window scroll target for pinned navigation to an entry.
     *
     * @param {number} runwayTop - Window-relative runway top.
     * @param {number} pinOffset - Sticky pin offset.
     * @param {number} travel - Total pinned travel distance.
     * @param {number} index - Target entry index.
     * @param {number} count - Total entry count.
     * @returns {number} Target window scrollY in pixels.
     */
    function calculateWindowScrollTarget(runwayTop, pinOffset, travel, index, count) {
        var ratio = count > 1 ? index / (count - 1) : 0;
        return runwayTop - pinOffset + travel * ratio;
    }

    /* ------------------------------------------------------------- Public API Export */
    var api = {
        MONTH_NAMES: MONTH_NAMES,
        parseMonthYear: parseMonthYear,
        parseDateRange: parseDateRange,
        entryMonth: entryMonth,
        entryYear: entryYear,
        computeRidgeHeights: computeRidgeHeights,
        calculateNorms: calculateNorms,
        computeSlope: computeSlope,
        computeSlopes: computeSlopes,
        computeRidgeGeometry: computeRidgeGeometry,
        calculatePinDistance: calculatePinDistance,
        calculatePinProgress: calculatePinProgress,
        calculateScrollOffset: calculateScrollOffset,
        findNearestEntryIndex: findNearestEntryIndex,
        clampIndex: clampIndex,
        calculateTrackScrollTarget: calculateTrackScrollTarget,
        calculateWindowScrollTarget: calculateWindowScrollTarget
    };

    // Attach to global scope in browser/worker environments
    if (typeof global !== 'undefined') {
        global.PortfolioTimelineMath = api;
    }

    // Export in CommonJS / Node.js test environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
