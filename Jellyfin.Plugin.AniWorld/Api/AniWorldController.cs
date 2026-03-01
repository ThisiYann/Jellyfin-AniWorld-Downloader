using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Net.Mime;
using System.Threading;
using System.Threading.Tasks;
using Jellyfin.Plugin.AniWorld.Services;
using MediaBrowser.Controller.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.AniWorld.Api;

/// <summary>
/// REST API controller for AniWorld Downloader plugin.
/// </summary>
[ApiController]
[Route("AniWorld")]
[Authorize]
[Produces(MediaTypeNames.Application.Json)]
public class AniWorldController : ControllerBase
{
    private readonly AniWorldService _aniWorldService;
    private readonly DownloadService _downloadService;
    private readonly IServerConfigurationManager _configManager;

    /// <summary>
    /// Initializes a new instance of the <see cref="AniWorldController"/> class.
    /// </summary>
    /// <param name="aniWorldService">AniWorld service.</param>
    /// <param name="downloadService">Download service.</param>
    /// <param name="configManager">Server configuration manager.</param>
    public AniWorldController(
        AniWorldService aniWorldService,
        DownloadService downloadService,
        IServerConfigurationManager configManager)
    {
        _aniWorldService = aniWorldService;
        _downloadService = downloadService;
        _configManager = configManager;
    }

    /// <summary>
    /// Search for anime on aniworld.to.
    /// </summary>
    /// <param name="query">Search query.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Search results.</returns>
    [HttpGet("Search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<SearchResult>>> Search(
        [Required] string query,
        CancellationToken cancellationToken)
    {
        var results = await _aniWorldService.SearchAsync(query, cancellationToken).ConfigureAwait(false);
        return Ok(results);
    }

    /// <summary>
    /// Get series information.
    /// </summary>
    /// <param name="url">The aniworld.to series URL.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Series information.</returns>
    [HttpGet("Series")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<SeriesInfo>> GetSeries(
        [Required] string url,
        CancellationToken cancellationToken)
    {
        var info = await _aniWorldService.GetSeriesInfoAsync(url, cancellationToken).ConfigureAwait(false);
        return Ok(info);
    }

    /// <summary>
    /// Get episodes for a season.
    /// </summary>
    /// <param name="url">The season URL.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Episode list.</returns>
    [HttpGet("Episodes")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<List<EpisodeRef>>> GetEpisodes(
        [Required] string url,
        CancellationToken cancellationToken)
    {
        var episodes = await _aniWorldService.GetEpisodesAsync(url, cancellationToken).ConfigureAwait(false);
        return Ok(episodes);
    }

    /// <summary>
    /// Get episode details (provider links).
    /// </summary>
    /// <param name="url">The episode URL.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Episode details.</returns>
    [HttpGet("Episode")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<ActionResult<EpisodeDetails>> GetEpisodeDetails(
        [Required] string url,
        CancellationToken cancellationToken)
    {
        var details = await _aniWorldService.GetEpisodeDetailsAsync(url, cancellationToken).ConfigureAwait(false);
        return Ok(details);
    }

    /// <summary>
    /// Start downloading an episode.
    /// </summary>
    /// <param name="request">Download request.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The download task info.</returns>
    [HttpPost("Download")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<DownloadTask>> StartDownload(
        [FromBody] DownloadRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(request.EpisodeUrl))
        {
            return BadRequest("Episode URL is required");
        }

        var config = Plugin.Instance?.Configuration;
        var outputPath = request.OutputPath ?? config?.DownloadPath ?? string.Empty;

        if (string.IsNullOrEmpty(outputPath))
        {
            return BadRequest("No download path configured. Please set a download path in the plugin settings.");
        }

        var language = request.LanguageKey ?? config?.PreferredLanguage ?? "1";
        var provider = request.Provider ?? config?.PreferredProvider ?? "VOE";

        var taskId = await _downloadService.StartDownloadAsync(
            request.EpisodeUrl,
            language,
            provider,
            outputPath,
            cancellationToken).ConfigureAwait(false);

        var task = _downloadService.GetDownload(taskId);
        return Ok(task);
    }

    /// <summary>
    /// Get all active downloads.
    /// </summary>
    /// <returns>List of downloads.</returns>
    [HttpGet("Downloads")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public ActionResult<List<DownloadTask>> GetDownloads()
    {
        return Ok(_downloadService.GetActiveDownloads());
    }

    /// <summary>
    /// Get a specific download task.
    /// </summary>
    /// <param name="id">Task ID.</param>
    /// <returns>Download task.</returns>
    [HttpGet("Downloads/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<DownloadTask> GetDownload(string id)
    {
        var task = _downloadService.GetDownload(id);
        if (task == null)
        {
            return NotFound();
        }

        return Ok(task);
    }

    /// <summary>
    /// Cancel a download.
    /// </summary>
    /// <param name="id">Task ID.</param>
    /// <returns>Success.</returns>
    [HttpDelete("Downloads/{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult CancelDownload(string id)
    {
        if (_downloadService.CancelDownload(id))
        {
            return Ok(new { success = true });
        }

        return NotFound();
    }
}

/// <summary>
/// Download request model.
/// </summary>
public class DownloadRequest
{
    /// <summary>Gets or sets the episode URL.</summary>
    public string EpisodeUrl { get; set; } = string.Empty;

    /// <summary>Gets or sets the language key.</summary>
    public string? LanguageKey { get; set; }

    /// <summary>Gets or sets the provider.</summary>
    public string? Provider { get; set; }

    /// <summary>Gets or sets the output path.</summary>
    public string? OutputPath { get; set; }
}
