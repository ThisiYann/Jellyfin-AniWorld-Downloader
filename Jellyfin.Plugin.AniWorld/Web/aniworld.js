const AW = {
    currentSeriesTitle: null,
    currentSeriesUrl: null,
    currentSeasonUrl: null,
    lastSearchQuery: null,
    lastSearchResults: null,
    downloadPollInterval: null,
    activeDownloadCount: 0,
    historyOffset: 0,
    historyStatusFilter: null,
    historySeriesFilter: null,

    // ── Tab switching ──
    switchTab: function (tab) {
        document.querySelectorAll('.aw-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
        document.getElementById('searchTab').style.display = tab === 'search' ? '' : 'none';
        document.getElementById('downloadsTab').style.display = tab === 'downloads' ? '' : 'none';
        document.getElementById('historyTab').style.display = tab === 'history' ? '' : 'none';

        if (tab === 'downloads') {
            this.loadDownloads();
            this.startPolling();
        } else {
            this.stopPolling();
        }

        if (tab === 'history') {
            this.historyOffset = 0;
            this.loadStats();
            this.loadHistory(true);
        }
    },

    // ── Search ──
    search: function () {
        var query = document.getElementById('aw-search-input').value.trim();
        if (!query) return;

        this.lastSearchQuery = query;
        var content = document.getElementById('aw-content');
        content.innerHTML = '<div class="aw-loading"><span class="aw-spinner"></span> Searching...</div>';

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Search', { query: query }),
            type: 'GET',
            dataType: 'json'
        }).then(function (results) {
            AW.lastSearchResults = results;
            AW.renderSearchResults(results);
        }).catch(function (err) {
            content.innerHTML = '<div class="aw-empty"><div class="aw-empty-icon">❌</div>Search failed: ' + esc(err.message || 'Unknown error') + '</div>';
        });
    },

    renderSearchResults: function (results) {
        var content = document.getElementById('aw-content');
        if (!results || results.length === 0) {
            content.innerHTML = '<div class="aw-empty"><div class="aw-empty-icon">🔍</div>No anime found. Try different keywords.</div>';
            return;
        }

        var html = '<div class="aw-grid">';
        results.forEach(function (item) {
            html += '<div class="aw-card" onclick="AW.showSeries(\'' + encodeURIComponent(item.Url) + '\', \'' + esc(item.Title).replace(/'/g, "\\'") + '\')">';
            html += '<h3>' + esc(item.Title) + '</h3>';
            if (item.Description) {
                html += '<p>' + esc(item.Description.substring(0, 120)) + (item.Description.length > 120 ? '...' : '') + '</p>';
            }
            html += '</div>';
        });
        html += '</div>';
        content.innerHTML = html;
    },

    // ── Series Detail ──
    showSeries: function (encodedUrl, title) {
        var url = decodeURIComponent(encodedUrl);
        this.currentSeriesUrl = url;
        var content = document.getElementById('aw-content');
        content.innerHTML = '<div class="aw-loading"><span class="aw-spinner"></span> Loading series info...</div>';

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Series', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (series) {
            AW.currentSeriesTitle = series.Title || title || 'Unknown';
            AW.renderSeries(series, url);
        }).catch(function (err) {
            content.innerHTML = '<div class="aw-empty"><div class="aw-empty-icon">❌</div>Failed to load series: ' + esc(err.message || 'Unknown error') + '</div>';
        });
    },

    renderSeries: function (series, seriesUrl) {
        var content = document.getElementById('aw-content');
        var html = '<button class="aw-btn aw-btn-secondary aw-back" onclick="AW.goBack()">← Back to Results</button>';

        html += '<div class="aw-series">';
        if (series.CoverImageUrl) {
            html += '<img class="aw-cover" src="' + esc(series.CoverImageUrl) + '" alt="Cover" onerror="this.style.display=\'none\'" />';
        }
        html += '<div class="aw-meta">';
        html += '<h2>' + esc(series.Title) + '</h2>';

        if (series.Genres && series.Genres.length > 0) {
            html += '<div class="aw-genres">';
            series.Genres.forEach(function (g) {
                html += '<span class="aw-genre">' + esc(g) + '</span>';
            });
            html += '</div>';
        }

        if (series.Description) {
            var desc = series.Description;
            if (desc.length > 300) {
                html += '<p>' + esc(desc.substring(0, 300)) + '...</p>';
            } else {
                html += '<p>' + esc(desc) + '</p>';
            }
        }
        html += '</div></div>';

        if (series.Seasons && series.Seasons.length > 0) {
            html += '<div class="aw-seasons">';
            series.Seasons.forEach(function (season, idx) {
                var cls = idx === 0 ? ' active' : '';
                html += '<button class="aw-season' + cls + '" data-url="' + esc(season.Url) + '" onclick="AW.loadSeason(\'' + encodeURIComponent(season.Url) + '\', this)">Season ' + season.Number + '</button>';
            });
            if (series.HasMovies) {
                var movieUrl = seriesUrl + '/filme';
                html += '<button class="aw-season" data-url="' + esc(movieUrl) + '" onclick="AW.loadSeason(\'' + encodeURIComponent(movieUrl) + '\', this)">🎬 Movies</button>';
            }
            html += '</div>';
        }

        html += '<div id="aw-season-bar"></div>';
        html += '<div id="aw-episodes"></div>';
        content.innerHTML = html;

        if (series.Seasons && series.Seasons.length > 0) {
            AW.loadSeason(encodeURIComponent(series.Seasons[0].Url));
        }
    },

    // ── Season Episodes ──
    loadSeason: function (encodedUrl, btn) {
        if (btn) {
            document.querySelectorAll('.aw-season').forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
        }

        var url = decodeURIComponent(encodedUrl);
        this.currentSeasonUrl = url;
        var epContainer = document.getElementById('aw-episodes');
        var barContainer = document.getElementById('aw-season-bar');
        if (!epContainer) return;

        epContainer.innerHTML = '<div class="aw-loading"><span class="aw-spinner"></span> Loading episodes...</div>';
        if (barContainer) barContainer.innerHTML = '';

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Episodes', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (episodes) {
            AW.renderEpisodes(episodes, url);
        }).catch(function (err) {
            epContainer.innerHTML = '<div class="aw-empty">Failed to load episodes: ' + esc(err.message || '') + '</div>';
        });
    },

    renderEpisodes: function (episodes, seasonUrl) {
        var epContainer = document.getElementById('aw-episodes');
        var barContainer = document.getElementById('aw-season-bar');

        if (!episodes || episodes.length === 0) {
            epContainer.innerHTML = '<div class="aw-empty"><div class="aw-empty-icon">📭</div>No episodes found.</div>';
            if (barContainer) barContainer.innerHTML = '';
            return;
        }

        if (barContainer) {
            var bar = '<div class="aw-season-actions">';
            bar += '<span class="aw-ep-count">' + episodes.length + ' episode' + (episodes.length === 1 ? '' : 's') + '</span>';
            bar += '<button class="aw-btn aw-btn-success aw-btn-sm" onclick="AW.downloadSeason(\'' + encodeURIComponent(seasonUrl) + '\')">⬇️ Download All</button>';
            bar += '</div>';
            barContainer.innerHTML = bar;
        }

        var html = '<div class="aw-episodes">';
        episodes.forEach(function (ep) {
            var label = ep.IsMovie ? 'Movie ' + ep.Number : ep.Number;
            var epId = 'ep-' + ep.Number + '-' + (ep.IsMovie ? 'movie' : 'ep');
            html += '<div class="aw-ep" id="' + epId + '">';
            html += '<span class="aw-ep-num">' + label + '</span>';
            html += '<span class="aw-ep-title" id="' + epId + '-title">Loading...</span>';
            html += '<span class="aw-ep-downloaded" id="' + epId + '-dl" style="display:none">✓ Downloaded</span>';
            html += '<div class="aw-ep-actions">';
            html += '<button class="aw-btn aw-btn-primary aw-btn-sm" onclick="AW.downloadEpisode(\'' + encodeURIComponent(ep.Url) + '\')">⬇️ Download</button>';
            html += '<button class="aw-btn aw-btn-secondary aw-btn-sm" onclick="AW.toggleProviders(\'' + encodeURIComponent(ep.Url) + '\', \'' + epId + '\')">Providers</button>';
            html += '</div>';
            html += '</div>';
            html += '<div id="' + epId + '-providers" class="aw-ep-providers" style="display:none"></div>';
        });
        html += '</div>';
        epContainer.innerHTML = html;

        // Load titles and check download status
        episodes.forEach(function (ep, idx) {
            var epId = 'ep-' + ep.Number + '-' + (ep.IsMovie ? 'movie' : 'ep');
            setTimeout(function () {
                AW.fetchEpisodeTitle(ep.Url, epId);
                AW.checkIsDownloaded(ep.Url, epId);
            }, idx * 150);
        });
    },

    fetchEpisodeTitle: function (url, epId) {
        var titleEl = document.getElementById(epId + '-title');
        if (!titleEl) return;

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Episode', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (details) {
            if (!titleEl) return;
            var title = details.TitleEn || details.TitleDe || '';
            if (details.TitleDe && details.TitleEn && details.TitleDe !== details.TitleEn) {
                titleEl.textContent = details.TitleEn + ' — ' + details.TitleDe;
            } else {
                titleEl.textContent = title || '—';
            }
        }).catch(function () {
            if (titleEl) titleEl.textContent = '—';
        });
    },

    checkIsDownloaded: function (url, epId) {
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/IsDownloaded', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (result) {
            if (result && result.downloaded) {
                var badge = document.getElementById(epId + '-dl');
                if (badge) badge.style.display = '';
            }
        }).catch(function () { /* ignore */ });
    },

    // ── Providers ──
    toggleProviders: function (encodedUrl, epId) {
        var panel = document.getElementById(epId + '-providers');
        if (!panel) return;

        if (panel.style.display !== 'none') {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = '';
        panel.innerHTML = '<div class="aw-loading"><span class="aw-spinner"></span> Loading...</div>';

        var url = decodeURIComponent(encodedUrl);
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Episode', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (details) {
            var langNames = { '1': '🇩🇪 German Dub', '2': '🇬🇧 English Sub', '3': '🇩🇪 German Sub' };
            var html = '';

            var hasAny = false;
            for (var langKey in details.ProvidersByLanguage) {
                hasAny = true;
                html += '<div class="aw-lang-group">';
                html += '<div class="aw-lang-label">' + esc(langNames[langKey] || 'Language ' + langKey) + '</div>';
                html += '<div class="aw-provider-btns">';
                var providers = details.ProvidersByLanguage[langKey];
                for (var prov in providers) {
                    html += '<button class="aw-btn aw-btn-secondary aw-btn-sm" onclick="AW.downloadWithOptions(\'' + encodeURIComponent(url) + '\', \'' + langKey + '\', \'' + esc(prov) + '\')">' + esc(prov) + '</button>';
                }
                html += '</div></div>';
            }

            if (!hasAny) {
                html = '<div style="opacity:0.5;padding:0.5em">No providers available for this episode.</div>';
            }

            panel.innerHTML = html;
        }).catch(function () {
            panel.innerHTML = '<div style="color:#ef5350;padding:0.5em">Failed to load providers.</div>';
        });
    },

    // ── Downloads ──
    downloadEpisode: function (encodedUrl) {
        var url = decodeURIComponent(encodedUrl);
        this._startDownload(url, null, null);
    },

    downloadWithOptions: function (encodedUrl, langKey, provider) {
        var url = decodeURIComponent(encodedUrl);
        this._startDownload(url, langKey, provider);
    },

    downloadSeason: function (encodedSeasonUrl) {
        var seasonUrl = decodeURIComponent(encodedSeasonUrl);
        var body = {
            SeasonUrl: seasonUrl,
            SeriesTitle: this.currentSeriesTitle
        };

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/DownloadSeason'),
            type: 'POST',
            data: JSON.stringify(body),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (tasks) {
            var count = tasks ? tasks.length : 0;
            if (count > 0) {
                Dashboard.alert('Queued ' + count + ' episode(s) for download!');
                AW.switchTab('downloads');
            } else {
                Dashboard.alert('All episodes already downloaded or no episodes found.');
            }
        }).catch(function (err) {
            Dashboard.alert('Batch download failed: ' + (err.message || 'Unknown error'));
        });
    },

    _startDownload: function (episodeUrl, langKey, provider) {
        var body = {
            EpisodeUrl: episodeUrl,
            SeriesTitle: this.currentSeriesTitle
        };
        if (langKey) body.LanguageKey = langKey;
        if (provider) body.Provider = provider;

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Download'),
            type: 'POST',
            data: JSON.stringify(body),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (task) {
            Dashboard.alert('Download started: ' + (task.EpisodeTitle || task.OutputPath || task.Id));
            AW.updateBadge(AW.activeDownloadCount + 1);
        }).catch(function (err) {
            Dashboard.alert('Download failed: ' + (err.message || 'Unknown error'));
        });
    },

    // ── Downloads Tab ──
    loadDownloads: function () {
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Downloads'),
            type: 'GET',
            dataType: 'json'
        }).then(function (downloads) {
            AW.renderDownloads(downloads);
        }).catch(function () {
            var container = document.getElementById('aw-downloads');
            if (container) container.innerHTML = '<div class="aw-empty">Failed to load downloads.</div>';
        });
    },

    renderDownloads: function (downloads) {
        var container = document.getElementById('aw-downloads');
        if (!container) return;

        var active = 0;
        if (downloads) {
            downloads.forEach(function (dl) {
                if (['Queued', 'Resolving', 'Extracting', 'Downloading', 'Retrying'].indexOf(dl.Status) !== -1) {
                    active++;
                }
            });
        }
        AW.activeDownloadCount = active;
        AW.updateBadge(active);

        if (!downloads || downloads.length === 0) {
            container.innerHTML = '<div class="aw-empty"><div class="aw-empty-icon">📭</div>No active downloads.<br>Search for anime and start downloading!</div>';
            return;
        }

        var hasCompleted = downloads.some(function (dl) {
            return ['Completed', 'Failed', 'Cancelled'].indexOf(dl.Status) !== -1;
        });

        var html = '';
        if (hasCompleted) {
            html += '<div class="aw-dl-actions"><button class="aw-btn aw-btn-secondary aw-btn-sm" onclick="AW.clearCompleted()">🧹 Clear Completed</button></div>';
        }

        html += '<div class="aw-dl">';
        downloads.forEach(function (dl) {
            var statusCls = 'aw-status-' + dl.Status.toLowerCase();
            var isActive = ['Queued', 'Resolving', 'Extracting', 'Downloading', 'Retrying'].indexOf(dl.Status) !== -1;
            var isFailed = dl.Status === 'Failed';
            var fileName = dl.OutputPath ? dl.OutputPath.split('/').pop().split('\\').pop() : dl.Id;

            html += '<div class="aw-dl-item">';
            html += '<div class="aw-dl-info">';
            html += '<strong>' + esc(dl.EpisodeTitle || fileName) + '</strong>';
            html += '<small>' + esc(dl.Provider) + ' · ' + esc(dl.Status);
            if (dl.RetryCount > 0) {
                html += ' (retry ' + dl.RetryCount + '/' + dl.MaxRetries + ')';
            }
            if (dl.FileSizeBytes > 0) {
                html += '<span class="aw-dl-size">' + formatSize(dl.FileSizeBytes) + '</span>';
            }
            html += '</small>';
            if (dl.Error && dl.Status !== 'Retrying') {
                html += '<div class="aw-dl-error">' + esc(dl.Error) + '</div>';
            }
            if (dl.Status === 'Retrying' && dl.Error) {
                html += '<div class="aw-dl-retry-info">⏳ ' + esc(dl.Error) + '</div>';
            }
            html += '</div>';

            html += '<div class="aw-dl-progress"><div class="aw-dl-bar" style="width:' + dl.Progress + '%"></div></div>';
            html += '<span class="aw-dl-pct">' + dl.Progress + '%</span>';
            html += '<span class="aw-status ' + statusCls + '">' + esc(dl.Status) + '</span>';

            html += '<div class="aw-dl-btns">';
            if (isActive) {
                html += '<button class="aw-btn aw-btn-danger aw-btn-sm" onclick="AW.cancelDownload(\'' + dl.Id + '\')" title="Cancel">✕</button>';
            }
            if (isFailed) {
                html += '<button class="aw-btn aw-btn-warning aw-btn-sm" onclick="AW.retryDownload(\'' + dl.Id + '\')" title="Retry">🔄</button>';
            }
            html += '</div>';

            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
    },

    cancelDownload: function (id) {
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Downloads/' + id),
            type: 'DELETE'
        }).then(function () {
            AW.loadDownloads();
        });
    },

    retryDownload: function (id) {
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Downloads/' + id + '/Retry'),
            type: 'POST'
        }).then(function () {
            Dashboard.alert('Retrying download...');
            AW.loadDownloads();
        }).catch(function (err) {
            Dashboard.alert('Retry failed: ' + (err.message || 'Unknown error'));
        });
    },

    clearCompleted: function () {
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Downloads/Clear'),
            type: 'POST'
        }).then(function () {
            AW.loadDownloads();
        });
    },

    updateBadge: function (count) {
        var badge = document.getElementById('aw-dl-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = '';
            } else {
                badge.style.display = 'none';
            }
        }
    },

    startPolling: function () {
        this.stopPolling();
        this.downloadPollInterval = setInterval(function () {
            AW.loadDownloads();
        }, 2500);
    },

    stopPolling: function () {
        if (this.downloadPollInterval) {
            clearInterval(this.downloadPollInterval);
            this.downloadPollInterval = null;
        }
    },

    // ── History Tab ──
    loadStats: function () {
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Stats'),
            type: 'GET',
            dataType: 'json'
        }).then(function (stats) {
            AW.renderStats(stats);
        }).catch(function () {
            var container = document.getElementById('aw-history-stats');
            if (container) container.innerHTML = '';
        });
    },

    renderStats: function (stats) {
        var container = document.getElementById('aw-history-stats');
        if (!container) return;

        var html = '<div class="aw-stats">';
        html += '<div class="aw-stat"><div class="aw-stat-value">' + stats.TotalDownloads + '</div><div class="aw-stat-label">Total Downloads</div></div>';
        html += '<div class="aw-stat"><div class="aw-stat-value green">' + stats.Completed + '</div><div class="aw-stat-label">Completed</div></div>';
        html += '<div class="aw-stat"><div class="aw-stat-value red">' + stats.Failed + '</div><div class="aw-stat-label">Failed</div></div>';
        html += '<div class="aw-stat"><div class="aw-stat-value">' + formatSize(stats.TotalBytes) + '</div><div class="aw-stat-label">Total Size</div></div>';
        html += '<div class="aw-stat"><div class="aw-stat-value orange">' + stats.UniqueSeriesCount + '</div><div class="aw-stat-label">Series</div></div>';
        html += '</div>';
        container.innerHTML = html;
    },

    loadHistory: function (reset) {
        if (reset) {
            this.historyOffset = 0;
        }

        var params = { limit: 30, offset: this.historyOffset };
        if (this.historyStatusFilter) params.status = this.historyStatusFilter;
        if (this.historySeriesFilter) params.series = this.historySeriesFilter;

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/History', params),
            type: 'GET',
            dataType: 'json'
        }).then(function (records) {
            AW.renderHistory(records, reset);
            AW.renderHistoryFilters();
        }).catch(function () {
            var container = document.getElementById('aw-history');
            if (container) container.innerHTML = '<div class="aw-empty">Failed to load history.</div>';
        });
    },

    renderHistoryFilters: function () {
        var container = document.getElementById('aw-history-filters-container');
        if (!container) return;

        // Only render once
        if (container.dataset.rendered === 'true') return;
        container.dataset.rendered = 'true';

        var html = '<div class="aw-hist-filters">';
        html += '<select id="aw-hist-status" onchange="AW.filterHistory()">';
        html += '<option value="">All Status</option>';
        html += '<option value="Completed">✅ Completed</option>';
        html += '<option value="Failed">❌ Failed</option>';
        html += '<option value="Cancelled">⛔ Cancelled</option>';
        html += '</select>';
        html += '<input type="text" id="aw-hist-series" placeholder="Filter by series..." style="padding:0.4em 0.7em;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:inherit;font-size:0.85em;min-width:200px;" />';
        html += '<button class="aw-btn aw-btn-secondary aw-btn-sm" onclick="AW.filterHistory()">Filter</button>';
        html += '</div>';
        container.innerHTML = html;
    },

    filterHistory: function () {
        var statusEl = document.getElementById('aw-hist-status');
        var seriesEl = document.getElementById('aw-hist-series');
        this.historyStatusFilter = statusEl ? statusEl.value || null : null;
        this.historySeriesFilter = seriesEl ? seriesEl.value.trim() || null : null;
        this.loadHistory(true);
    },

    renderHistory: function (records, reset) {
        var container = document.getElementById('aw-history');
        if (!container) return;

        if ((!records || records.length === 0) && reset) {
            container.innerHTML = '<div class="aw-empty"><div class="aw-empty-icon">📭</div>No download history yet.<br>Downloaded episodes will appear here.</div>';
            return;
        }

        var langNames = { '1': '🇩🇪 DE Dub', '2': '🇬🇧 EN Sub', '3': '🇩🇪 DE Sub' };
        var html = reset ? '<div class="aw-history">' : '';

        records.forEach(function (rec) {
            var statusCls = 'aw-status-' + rec.Status.toLowerCase();
            var title = rec.EpisodeTitle || '';
            var seLabel = 'S' + String(rec.Season).padStart(2, '0') + 'E' + String(rec.Episode).padStart(2, '0');

            html += '<div class="aw-hist-item">';
            html += '<div class="aw-hist-info">';
            html += '<strong>' + esc(rec.SeriesTitle) + ' ' + seLabel;
            if (title) html += ' - ' + esc(title);
            html += '</strong>';
            html += '<small>' + esc(rec.Provider) + ' · ' + esc(langNames[rec.Language] || rec.Language);
            if (rec.Error) html += ' · ' + esc(rec.Error.substring(0, 60));
            html += '</small>';
            html += '</div>';
            html += '<div class="aw-hist-meta">';
            if (rec.FileSizeBytes > 0) {
                html += '<span class="aw-hist-size">' + formatSize(rec.FileSizeBytes) + '</span>';
            }
            html += '<span class="aw-status ' + statusCls + '">' + esc(rec.Status) + '</span>';
            html += '<span class="aw-hist-date">' + formatDate(rec.StartedAt) + '</span>';
            html += '</div>';
            html += '</div>';
        });

        if (reset) {
            html += '</div>';
            container.innerHTML = html;
        } else {
            var histDiv = container.querySelector('.aw-history');
            if (histDiv) {
                histDiv.insertAdjacentHTML('beforeend', html);
            }
        }

        // Show "load more" if we got a full page
        var moreContainer = container.querySelector('.aw-hist-more');
        if (moreContainer) moreContainer.remove();

        if (records && records.length >= 30) {
            AW.historyOffset += records.length;
            container.insertAdjacentHTML('beforeend', '<div class="aw-hist-more"><button class="aw-btn aw-btn-secondary" onclick="AW.loadHistory(false)">Load More</button></div>');
        }
    },

    goBack: function () {
        if (this.lastSearchResults) {
            this.renderSearchResults(this.lastSearchResults);
        } else if (this.lastSearchQuery) {
            document.getElementById('aw-search-input').value = this.lastSearchQuery;
            this.search();
        } else {
            document.getElementById('aw-content').innerHTML = '';
        }
    }
};

function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function formatSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(isoStr) {
    if (!isoStr) return '—';
    try {
        var d = new Date(isoStr);
        var now = new Date();
        var diffMs = now - d;
        var diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return diffMins + 'm ago';
        var diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return diffHrs + 'h ago';
        var diffDays = Math.floor(diffHrs / 24);
        if (diffDays < 7) return diffDays + 'd ago';

        return d.toLocaleDateString();
    } catch (e) {
        return isoStr;
    }
}

// Bind Enter key to search
document.getElementById('aw-search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        AW.search();
    }
});

// Poll badge count periodically even when on search tab
setInterval(function () {
    ApiClient.fetch({
        url: ApiClient.getUrl('AniWorld/Downloads'),
        type: 'GET',
        dataType: 'json'
    }).then(function (downloads) {
        var active = 0;
        if (downloads) {
            downloads.forEach(function (dl) {
                if (['Queued', 'Resolving', 'Extracting', 'Downloading', 'Retrying'].indexOf(dl.Status) !== -1) {
                    active++;
                }
            });
        }
        AW.updateBadge(active);
    }).catch(function () { /* ignore */ });
}, 10000);
