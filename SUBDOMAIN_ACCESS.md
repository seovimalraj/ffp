# FFP Subdomain Architecture

All FFP services are now accessible via dedicated subdomains for improved routing and service isolation.

## Main Application
- **app.frigate.ai** - Main application entry point
  - Routes to Next.js frontend
  - Integrated /api and /cad paths for seamless service access
  - Best for end-users

## Direct Service Access

### Web Frontend
- **ffp-web.frigate.ai**
  - Direct access to Next.js frontend (port 3000)
  - Useful for debugging frontend issues
  - Same content as app.frigate.ai but without backend proxying

### API Backend
- **ffp-api.frigate.ai**
  - Direct access to NestJS API (port 4001)
  - RESTful API endpoints
  - CORS enabled for cross-origin requests
  - Useful for API testing and external integrations

### CAD Processing Service
- **ffp-cad.frigate.ai**
  - Direct access to Python FastAPI CAD service (port 10001)
  - Handles CAD file processing and conversions
  - Useful for direct CAD service integration

### Redis Cache
- **ffp-redis.frigate.ai**
  - Information page about Redis service
  - Redis itself (port 6379) is TCP-only, no HTTP interface
  - Internal connection details displayed

## Supabase
- **supabase.frigate.ai**
  - Supabase Studio and API access
  - Protected with HTTP Basic Authentication
    - Username: `admin`
    - Password: `SecureSupabase2026!`
  - API endpoints bypass authentication for service access

## SSL/TLS
All subdomains use Cloudflare Origin SSL certificates:
- Wildcard certificate: `*.frigate.ai`
- Valid until: 2040-12-08
- Automatic HTTPS enforcement (HTTP → HTTPS redirect)

## Network Architecture
```
                        ┌─────────────────┐
                        │   Cloudflare    │
                        │   (SSL/Proxy)   │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  Nginx Reverse Proxy    │
                    │   (ffp-nginx:80/443)    │
                    └─┬───────┬───────┬───────┘
                      │       │       │
         ┏━━━━━━━━━━━━┷━━━┓ ┏━┷━━━┓ ┏━┷━━━━━━━━━━━━┓
         ┃  app.frigate.ai ┃ ┃  ffp-* ┃ ┃ supabase.*  ┃
         ┗━━━━━━━┬━━━━━━━━┛ ┗━┯━━━┛ ┗━━━┯━━━━━━━━━┛
                 │            │          │
      ┌──────────┼────────────┼──────────┘
      │          │            │
   ┌──▼──┐  ┌───▼───┐  ┌────▼────┐
   │ Web │  │  API  │  │   CAD   │
   │:3000│  │ :4001 │  │ :10001  │
   └─────┘  └───────┘  └─────────┘
                 │
             ┌───▼───┐
             │ Redis │
             │ :6379 │
             └───────┘
```

## Service Status Check
```bash
# Check all services
docker ps --filter "name=ffp-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Test subdomain access
curl -I https://app.frigate.ai
curl -I https://ffp-web.frigate.ai
curl -I https://ffp-api.frigate.ai
curl -I https://ffp-cad.frigate.ai
curl https://ffp-redis.frigate.ai
```

## Deployment Date
- Initial setup: December 2024
- Subdomain architecture: January 5, 2026
- Last updated: 2026-01-05 07:06 UTC

## Notes
- All services communicate internally via Docker network (ffp_app-network)
- External access only through nginx reverse proxy on ports 80/443
- Cloudflare handles DNS and provides DDoS protection
- Environment variables updated to use subdomain URLs for proper CORS handling
