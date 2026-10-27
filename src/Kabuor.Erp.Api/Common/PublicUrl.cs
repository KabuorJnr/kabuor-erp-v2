// The address the outside world reaches this server on, for links people are sent and for the callbacks Safaricom
// makes. Some of those callbacks carry a secret in the path, so the address can't come from the request's Host
// header: anyone can put any Host on a request, and Safaricom would then hand the secret to their server.
namespace Kabuor.Erp.Common;

public static class PublicUrl
{
    /// <summary>App:PublicUrl if set, else the address Render gives the service (RENDER_EXTERNAL_URL); the request's
    /// own host only when neither is set, as in development.</summary>
    public static string Of(HttpRequest request)
    {
        var config = request.HttpContext.RequestServices.GetRequiredService<IConfiguration>();
        var configured = config["App:PublicUrl"] is { Length: > 0 } url ? url : config["RENDER_EXTERNAL_URL"];
        return string.IsNullOrWhiteSpace(configured) ? $"{request.Scheme}://{request.Host}" : configured.Trim().TrimEnd('/');
    }
}
