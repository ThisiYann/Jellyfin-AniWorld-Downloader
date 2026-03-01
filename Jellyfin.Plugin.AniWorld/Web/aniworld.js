const AniWorld = {
    currentView: 'search',
    downloadPollInterval: null,

    switchTab: function (tab) {
        document.querySelectorAll('.aniworld-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
        document.getElementById('searchTab').style.display = tab === 'search' ? '' : 'none';
        document.getElementById('downloadsTab').style.display = tab === 'downloads' ? '' : 'none';

        if (tab === 'downloads') {
            this.loadDownloads();
            this.startDownloadPolling();
        } else {
            this.stopDownloadPolling();
        }
    },

    search: function () {
        var query = document.getElementById('aniworld-search-input').value.trim();
        if (!query) return;

        var content = document.getElementById('aniworld-content');
        content.innerHTML = '<div class="aniworld-empty">Searching...</div>';

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Search', { query: query }),
            type: 'GET',
            dataType: 'json'
        }).then(function (results) {
            if (!results || results.length === 0) {
                content.innerHTML = '<div class="aniworld-empty">No results found.</div>';
                return;
            }

            var html = '<div class="aniworld-results">';
            results.forEach(function (item) {
                html += '<div class="aniworld-card" onclick="AniWorld.showSeries(\'' + encodeURIComponent(item.Url) + '\')">';
                html += '<h3>' + escapeHtml(item.Title) + '</h3>';
                if (item.Description) {
                    html += '<p>' + escapeHtml(item.Description.substring(0, 150)) + '</p>';
                }
                html += '</div>';
            });
            html += '</div>';
            content.innerHTML = html;
        }).catch(function (err) {
            content.innerHTML = '<div class="aniworld-empty">Search failed: ' + escapeHtml(err.message || 'Unknown error') + '</div>';
        });
    },

    showSeries: function (encodedUrl) {
        var url = decodeURIComponent(encodedUrl);
        var content = document.getElementById('aniworld-content');
        content.innerHTML = '<div class="aniworld-empty">Loading series info...</div>';

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Series', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (series) {
            var html = '<button class="aniworld-btn aniworld-btn-secondary aniworld-back-btn" onclick="AniWorld.goBack()">Back to Results</button>';

            html += '<div class="aniworld-series-header">';
            if (series.CoverImageUrl) {
                html += '<img class="aniworld-cover" src="' + escapeHtml(series.CoverImageUrl) + '" alt="Cover" />';
            }
            html += '<div class="aniworld-series-info">';
            html += '<h2>' + escapeHtml(series.Title) + '</h2>';

            if (series.Genres && series.Genres.length > 0) {
                html += '<div class="aniworld-genres">';
                series.Genres.forEach(function (g) {
                    html += '<span class="aniworld-genre">' + escapeHtml(g) + '</span>';
                });
                html += '</div>';
            }

            if (series.Description) {
                html += '<p>' + escapeHtml(series.Description) + '</p>';
            }
            html += '</div></div>';

            // Season buttons
            if (series.Seasons && series.Seasons.length > 0) {
                html += '<div class="aniworld-seasons">';
                series.Seasons.forEach(function (season, idx) {
                    var activeClass = idx === 0 ? ' active' : '';
                    html += '<button class="aniworld-season-btn' + activeClass + '" onclick="AniWorld.loadSeason(\'' + encodeURIComponent(season.Url) + '\', this)">Season ' + season.Number + '</button>';
                });
                if (series.HasMovies) {
                    var movieUrl = url + '/filme';
                    html += '<button class="aniworld-season-btn" onclick="AniWorld.loadSeason(\'' + encodeURIComponent(movieUrl) + '\', this)">Movies</button>';
                }
                html += '</div>';
            }

            html += '<div id="aniworld-episodes"></div>';
            content.innerHTML = html;

            // Load first season
            if (series.Seasons && series.Seasons.length > 0) {
                AniWorld.loadSeason(encodeURIComponent(series.Seasons[0].Url));
            }
        }).catch(function (err) {
            content.innerHTML = '<div class="aniworld-empty">Failed to load series: ' + escapeHtml(err.message || 'Unknown error') + '</div>';
        });
    },

    loadSeason: function (encodedUrl, btn) {
        if (btn) {
            document.querySelectorAll('.aniworld-season-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        var url = decodeURIComponent(encodedUrl);
        var epContainer = document.getElementById('aniworld-episodes');
        if (!epContainer) return;
        epContainer.innerHTML = '<div class="aniworld-empty">Loading episodes...</div>';

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Episodes', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (episodes) {
            if (!episodes || episodes.length === 0) {
                epContainer.innerHTML = '<div class="aniworld-empty">No episodes found.</div>';
                return;
            }

            var html = '<div class="aniworld-episodes">';
            episodes.forEach(function (ep) {
                var label = ep.IsMovie ? 'Movie ' + ep.Number : 'Episode ' + ep.Number;
                html += '<div class="aniworld-episode">';
                html += '<div class="aniworld-episode-info">';
                html += '<span class="aniworld-episode-num">' + label + '</span>';
                html += '</div>';
                html += '<div class="aniworld-episode-actions">';
                html += '<button class="aniworld-btn aniworld-btn-primary" onclick="AniWorld.downloadEpisode(\'' + encodeURIComponent(ep.Url) + '\')">Download</button>';
                html += '<button class="aniworld-btn aniworld-btn-secondary" onclick="AniWorld.showProviders(\'' + encodeURIComponent(ep.Url) + '\', this)">Providers</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
            epContainer.innerHTML = html;
        });
    },

    showProviders: function (encodedUrl, btn) {
        var url = decodeURIComponent(encodedUrl);
        var row = btn.closest('.aniworld-episode');
        var existing = row.querySelector('.aniworld-providers-panel');
        if (existing) {
            existing.remove();
            return;
        }

        var panel = document.createElement('div');
        panel.className = 'aniworld-providers-panel';
        panel.innerHTML = 'Loading providers...';
        row.appendChild(panel);

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Episode', { url: url }),
            type: 'GET',
            dataType: 'json'
        }).then(function (details) {
            var langNames = { '1': 'German Dub', '2': 'English Sub', '3': 'German Sub' };
            var html = '<div style="padding: 0.5em; background: rgba(0,0,0,0.2); border-radius: 4px; margin-top: 0.5em;">';

            if (details.TitleDe) html += '<small>DE: ' + escapeHtml(details.TitleDe) + '</small><br/>';
            if (details.TitleEn) html += '<small>EN: ' + escapeHtml(details.TitleEn) + '</small><br/>';

            for (var langKey in details.ProvidersByLanguage) {
                html += '<div style="margin-top: 0.5em;"><strong>' + escapeHtml(langNames[langKey] || 'Language ' + langKey) + ':</strong> ';
                var providers = details.ProvidersByLanguage[langKey];
                for (var prov in providers) {
                    html += '<button class="aniworld-btn aniworld-btn-secondary" style="margin: 2px;" onclick="AniWorld.downloadEpisodeWithOptions(\'' + encodeURIComponent(url) + '\', \'' + langKey + '\', \'' + prov + '\')">' + escapeHtml(prov) + '</button> ';
                }
                html += '</div>';
            }
            html += '</div>';
            panel.innerHTML = html;
        });
    },

    downloadEpisode: function (encodedUrl) {
        var url = decodeURIComponent(encodedUrl);
        this._startDownload(url, null, null);
    },

    downloadEpisodeWithOptions: function (encodedUrl, langKey, provider) {
        var url = decodeURIComponent(encodedUrl);
        this._startDownload(url, langKey, provider);
    },

    _startDownload: function (episodeUrl, langKey, provider) {
        var body = { EpisodeUrl: episodeUrl };
        if (langKey) body.LanguageKey = langKey;
        if (provider) body.Provider = provider;

        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Download'),
            type: 'POST',
            data: JSON.stringify(body),
            contentType: 'application/json',
            dataType: 'json'
        }).then(function (task) {
            Dashboard.alert('Download started: ' + (task.EpisodeTitle || task.Id));
            AniWorld.switchTab('downloads');
        }).catch(function (err) {
            Dashboard.alert('Download failed: ' + (err.message || 'Unknown error'));
        });
    },

    loadDownloads: function () {
        var container = document.getElementById('aniworld-downloads');
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Downloads'),
            type: 'GET',
            dataType: 'json'
        }).then(function (downloads) {
            if (!downloads || downloads.length === 0) {
                container.innerHTML = '<div class="aniworld-empty">No active downloads.</div>';
                return;
            }

            var html = '';
            downloads.forEach(function (dl) {
                var statusClass = 'aniworld-status-' + dl.Status.toLowerCase();
                html += '<div class="aniworld-download-item">';
                html += '<div style="flex:1">';
                html += '<strong>' + escapeHtml(dl.EpisodeTitle || dl.Id) + '</strong>';
                html += '<br/><small>' + escapeHtml(dl.Provider) + '</small>';
                html += '</div>';
                html += '<div class="aniworld-download-progress"><div class="aniworld-download-bar" style="width:' + dl.Progress + '%"></div></div>';
                html += '<span>' + dl.Progress + '%</span>';
                html += '<span class="aniworld-status ' + statusClass + '">' + dl.Status + '</span>';
                if (dl.Status === 'Downloading' || dl.Status === 'Queued' || dl.Status === 'Resolving' || dl.Status === 'Extracting') {
                    html += '<button class="aniworld-btn aniworld-btn-secondary" onclick="AniWorld.cancelDownload(\'' + dl.Id + '\')">Cancel</button>';
                }
                if (dl.Error) {
                    html += '<br/><small style="color:#f44336">' + escapeHtml(dl.Error) + '</small>';
                }
                html += '</div>';
            });
            container.innerHTML = html;
        });
    },

    cancelDownload: function (id) {
        ApiClient.fetch({
            url: ApiClient.getUrl('AniWorld/Downloads/' + id),
            type: 'DELETE'
        }).then(function () {
            AniWorld.loadDownloads();
        });
    },

    startDownloadPolling: function () {
        this.stopDownloadPolling();
        this.downloadPollInterval = setInterval(function () {
            AniWorld.loadDownloads();
        }, 3000);
    },

    stopDownloadPolling: function () {
        if (this.downloadPollInterval) {
            clearInterval(this.downloadPollInterval);
            this.downloadPollInterval = null;
        }
    },

    goBack: function () {
        var input = document.getElementById('aniworld-search-input');
        if (input && input.value) {
            this.search();
        } else {
            document.getElementById('aniworld-content').innerHTML = '';
        }
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Bind enter key to search
document.getElementById('aniworld-search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        AniWorld.search();
    }
});
