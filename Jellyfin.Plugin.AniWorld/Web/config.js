const AniWorldConfig = {
    pluginId: 'e93d1d02-df60-4545-ae3c-7bb87dff024c',

    loadConfig: function () {
        Dashboard.showLoadingMsg();
        ApiClient.getPluginConfiguration(this.pluginId).then(function (config) {
            document.getElementById('txtDownloadPath').value = config.DownloadPath || '';
            document.getElementById('selPreferredLanguage').value = config.PreferredLanguage || '1';
            document.getElementById('selPreferredProvider').value = config.PreferredProvider || 'VOE';
            document.getElementById('txtNamingTemplate').value = config.NamingTemplate || '{title} ({year})/{title} S{season}E{episode}.mkv';
            document.getElementById('txtMaxDownloads').value = config.MaxConcurrentDownloads || 2;
            Dashboard.hideLoadingMsg();
        });
    },

    saveConfig: function () {
        Dashboard.showLoadingMsg();
        ApiClient.getPluginConfiguration(this.pluginId).then(function (config) {
            config.DownloadPath = document.getElementById('txtDownloadPath').value;
            config.PreferredLanguage = document.getElementById('selPreferredLanguage').value;
            config.PreferredProvider = document.getElementById('selPreferredProvider').value;
            config.NamingTemplate = document.getElementById('txtNamingTemplate').value;
            config.MaxConcurrentDownloads = parseInt(document.getElementById('txtMaxDownloads').value) || 2;

            ApiClient.updatePluginConfiguration(AniWorldConfig.pluginId, config).then(function () {
                Dashboard.processPluginConfigurationUpdateResult();
            });
        });
    }
};

document.getElementById('AniWorldConfigForm').addEventListener('submit', function (e) {
    e.preventDefault();
    AniWorldConfig.saveConfig();
    return false;
});

AniWorldConfig.loadConfig();
