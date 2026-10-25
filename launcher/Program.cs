using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;

const int Port = 48173;
var resources = ResourceMap.Create();
var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "unknown";
if (!resources.ContainsKey("/index.html"))
{
    Console.Error.WriteLine("WireBench resources are missing. Rebuild the release package.");
    return 1;
}

using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, args) =>
{
    args.Cancel = true;
    stop.Cancel();
};

using var listener = new TcpListener(IPAddress.Loopback, Port);
try
{
    listener.Start();
}
catch (SocketException)
{
    var existingUrl = $"http://127.0.0.1:{Port}/";
    if (await IsSameVersionAlreadyRunningAsync(existingUrl, version))
    {
        TryOpenBrowser(existingUrl);
        return 0;
    }

    Console.Error.WriteLine($"Port {Port} is already in use. Close the other app and start WireBench again.");
    return 1;
}

var url = $"http://127.0.0.1:{Port}/";

Console.WriteLine($"WireBench {version} is running at {url}");
Console.WriteLine("Close this window or press Ctrl+C to stop the local server.");
TryOpenBrowser(url);

try
{
    while (!stop.IsCancellationRequested)
    {
        var client = await listener.AcceptTcpClientAsync(stop.Token);
        _ = HandleClientAsync(client, resources, version, stop.Token);
    }
}
catch (OperationCanceledException) when (stop.IsCancellationRequested)
{
    // Normal shutdown from Ctrl+C or the console window.
}
finally
{
    listener.Stop();
}

return 0;

static async Task HandleClientAsync(
    TcpClient client,
    IReadOnlyDictionary<string, string> resources,
    string version,
    CancellationToken cancellationToken)
{
    using (client)
    using (var stream = client.GetStream())
    {
        try
        {
            var request = await ReadRequestAsync(stream, cancellationToken);
            if (request is null)
            {
                await WriteResponseAsync(stream, 400, "text/plain; charset=utf-8", "Bad request\n", cancellationToken);
                return;
            }

            var (method, target) = request.Value;
            if (!string.Equals(method, "GET", StringComparison.Ordinal) &&
                !string.Equals(method, "HEAD", StringComparison.Ordinal))
            {
                await WriteResponseAsync(stream, 405, "text/plain; charset=utf-8", "Method not allowed\n", cancellationToken);
                return;
            }

            var path = GetSafePath(target);
            if (path is null)
            {
                await WriteResponseAsync(stream, 400, "text/plain; charset=utf-8", "Bad request\n", cancellationToken);
                return;
            }

            if (path == "/__wirebench_health")
            {
                await WriteResponseAsync(
                    stream,
                    200,
                    "text/plain; charset=utf-8",
                    method == "HEAD" ? "" : $"wirebench-launcher:{version}\n",
                    cancellationToken);
                return;
            }

            if (!resources.TryGetValue(path, out var resourceName))
            {
                if (!Path.HasExtension(path))
                {
                    resourceName = resources["/index.html"];
                }
                else
                {
                    await WriteResponseAsync(stream, 404, "text/plain; charset=utf-8", "Not found\n", cancellationToken);
                    return;
                }
            }

            await WriteResourceAsync(stream, resourceName, method == "HEAD", cancellationToken);
        }
        catch (IOException)
        {
            // The browser may close a request while the launcher is shutting down.
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
    }
}

static async Task<(string Method, string Target)?> ReadRequestAsync(
    NetworkStream stream,
    CancellationToken cancellationToken)
{
    var buffer = new byte[16 * 1024];
    var used = 0;
    while (used < buffer.Length)
    {
        var read = await stream.ReadAsync(buffer.AsMemory(used, buffer.Length - used), cancellationToken);
        if (read == 0) return null;
        used += read;
        if (used >= 4 && buffer.AsSpan(0, used).IndexOf("\r\n\r\n"u8) >= 0)
        {
            break;
        }
    }

    var headerText = Encoding.ASCII.GetString(buffer, 0, used);
    var requestLine = headerText.Split("\r\n", 2, StringSplitOptions.None)[0];
    var parts = requestLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);
    return parts.Length >= 2 ? (parts[0], parts[1]) : null;
}

static string? GetSafePath(string target)
{
    if (!Uri.TryCreate(target, UriKind.RelativeOrAbsolute, out var uri)) return null;
    var path = uri.IsAbsoluteUri ? uri.AbsolutePath : target.Split('?', 2)[0];
    path = Uri.UnescapeDataString(path).Replace('\\', '/');
    if (!path.StartsWith('/')) path = "/" + path;
    if (path.Contains("..", StringComparison.Ordinal)) return null;
    return path == "/" ? "/index.html" : path;
}

static async Task WriteResourceAsync(
    NetworkStream stream,
    string resourceName,
    bool headOnly,
    CancellationToken cancellationToken)
{
    await using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName);
    if (resource is null)
    {
        await WriteResponseAsync(stream, 404, "text/plain; charset=utf-8", "Not found\n", cancellationToken);
        return;
    }

    var contentType = ContentType(resourceName);
    var header = $"HTTP/1.1 200 OK\r\nContent-Type: {contentType}\r\nContent-Length: {resource.Length}\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n";
    await stream.WriteAsync(Encoding.ASCII.GetBytes(header), cancellationToken);
    if (!headOnly) await resource.CopyToAsync(stream, cancellationToken);
}

static async Task WriteResponseAsync(
    NetworkStream stream,
    int status,
    string contentType,
    string body,
    CancellationToken cancellationToken)
{
    var bytes = Encoding.UTF8.GetBytes(body);
    var reason = status switch
    {
        200 => "OK",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        _ => "Error",
    };
    var header = $"HTTP/1.1 {status} {reason}\r\nContent-Type: {contentType}\r\nContent-Length: {bytes.Length}\r\nConnection: close\r\n\r\n";
    await stream.WriteAsync(Encoding.ASCII.GetBytes(header), cancellationToken);
    await stream.WriteAsync(bytes, cancellationToken);
}

static string ContentType(string resourceName) =>
    Path.GetExtension(resourceName).ToLowerInvariant() switch
    {
        ".html" => "text/html; charset=utf-8",
        ".css" => "text/css; charset=utf-8",
        ".js" => "text/javascript; charset=utf-8",
        ".json" => "application/json; charset=utf-8",
        ".svg" => "image/svg+xml",
        ".png" => "image/png",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".webp" => "image/webp",
        ".ico" => "image/x-icon",
        _ => "application/octet-stream",
    };

static void TryOpenBrowser(string url)
{
    if (Environment.GetEnvironmentVariable("WIREBENCH_NO_BROWSER") == "1") return;

    try
    {
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }
    catch (Exception error)
    {
        Console.WriteLine($"Open this address in a browser: {url} ({error.Message})");
    }
}

static async Task<bool> IsSameVersionAlreadyRunningAsync(string baseUrl, string version)
{
    try
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(800) };
        var health = await client.GetStringAsync(new Uri(new Uri(baseUrl), "__wirebench_health"));
        return string.Equals(health.Trim(), $"wirebench-launcher:{version}", StringComparison.Ordinal);
    }
    catch (HttpRequestException)
    {
        return false;
    }
    catch (TaskCanceledException)
    {
        return false;
    }
}

static class ResourceMap
{
    public static IReadOnlyDictionary<string, string> Create()
    {
        const string marker = "dist/";
        return Assembly.GetExecutingAssembly()
            .GetManifestResourceNames()
            .Select(name => (name, normalized: name.Replace('\\', '/')))
            .Where(item => item.normalized.Contains(marker, StringComparison.Ordinal))
            .Select(item => (path: "/" + item.normalized[(item.normalized.IndexOf(marker, StringComparison.Ordinal) + marker.Length)..], item.name))
            .GroupBy(item => item.path, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.First().name, StringComparer.Ordinal);
    }
}
