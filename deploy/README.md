# Production Deploy

GitHub Actions builds and tests the storefront, uploads the compiled bundle to
the VPS, runs Prisma migrations, and restarts the API service.

Required GitHub repository secrets:

- `SSH_PRIVATE_KEY`: private key matching `/home/deploy/.ssh/authorized_keys`
- `SSH_HOST`: optional, defaults to `185.183.158.63`
- `SSH_USER`: optional, defaults to `deploy`
- `SSH_PORT`: optional, defaults to `22`
- `VITE_API_BASE_URL`: optional, defaults to `https://borabilgic.net.tr/api/v1`

Runtime API environment lives on the server at:

```text
/etc/bora-bilgic-teknik-store/api.env
```

R2 and PayTR keys can be added to that file later without changing the workflow.

## TLS

The bundled nginx config (`deploy/nginx/bora-bilgic-teknik-store.conf`) listens
on port 80 only and does not terminate TLS. Terminate TLS either on the VPS
with certbot/Let's Encrypt (add a 443 server block and redirect port 80 to it)
or in front of the server with a CDN such as Cloudflare. If TLS is already
terminated upstream (CDN or another layer), treat this section as
informational; the nginx behavior is intentionally left unchanged.
