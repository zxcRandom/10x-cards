# API Endpoint Implementation Plan: GET /api/v1/health

## 1. Przegląd punktu końcowego

Endpoint `GET /api/v1/health` służy jako health check dla systemu, umożliwiając monitorowanie stanu aplikacji i jej zależności. Jest to publiczny endpoint (nie wymaga autentykacji) używany przez load balancers, monitoring systems i DevOps tools do sprawdzania dostępności serwisu.

**Główne funkcjonalności:**
- Sprawdzenie liveness serwera (czy aplikacja działa)
- Weryfikacja połączenia z bazą danych Supabase
- Zwrócenie aktualnego czasu serwera
- Szybka odpowiedź dla monitoring systems

**Kluczowe założenia:**
- Public endpoint (brak autentykacji)
- Bardzo szybka odpowiedź (<100ms)
- Minimalne obciążenie systemu
- Zawsze dostępny (brak rate limiting)
- Real-time status (brak cache)

## 2. Szczegóły żądania

### Metoda HTTP
`GET`

### Struktura URL
```
GET /api/v1/health
```

### Headers
```
Content-Type: application/json
```

### Request Body
Brak (GET request)

### Query Parameters
Brak

### Przykładowe żądanie
```bash
curl -X GET http://localhost:4321/api/v1/health
```

## 3. Wykorzystywane typy

### Response DTOs

**HealthDTO** (Response) - już zdefiniowany w `src/types.ts`:
```typescript
export interface HealthDTO {
  status: 'ok';
  time: string; // ISO-8601 timestamp
}
```

### Error Response Types

**ErrorResponse** - dla błędów 500:
```typescript
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: string;
  }
}
```

### Internal Types

**HealthCheckResult** - używany wewnętrznie:
```typescript
interface HealthCheckResult {
  isHealthy: boolean;
  databaseConnected: boolean;
  timestamp: string;
  error?: string;
}
```

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "status": "ok",
  "time": "2025-10-15T10:30:00.000Z"
}
```

**Headers:**
```
Content-Type: application/json
Cache-Control: no-cache
```

### Error Response (500 Internal Server Error)

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Health check failed",
    "details": "Database connection failed"
  }
}
```

**Headers:**
```
Content-Type: application/json
Cache-Control: no-cache
```

## 5. Przepływ danych

### Architektura wysokiego poziomu

```
Client Request (GET /api/v1/health)
    ↓
API Route Handler (src/pages/api/v1/health.ts)
    ↓
[1] Database Connectivity Check
    ↓
[2] Generate Timestamp
    ↓
[3] Return HealthDTO or ErrorResponse
```

### Szczegółowy przepływ krok po kroku

#### KROK 1: Database Connectivity Check
1. Wykonaj prosty query do Supabase: `SELECT 1`
2. Sprawdź czy query się powiódł
3. Jeśli błąd → zwróć 500 Internal Server Error
4. Jeśli sukces → kontynuuj

#### KROK 2: Generate Response
1. Pobierz aktualny czas: `new Date().toISOString()`
2. Utwórz `HealthDTO` object
3. Zwróć response z statusem 200

#### KROK 3: Error Handling
1. Jeśli database check failed → 500 z ErrorResponse
2. Jeśli inne błędy → 500 z generic message
3. Loguj błędy do console (dla monitoring)

### Przepływ obsługi błędów

```
Database Connection Error
    ↓
Catch in handler
    ↓
Log error to console
    ↓
Return 500 with ErrorResponse
```

```
Other System Error
    ↓
Catch in handler
    ↓
Log error to console
    ↓
Return 500 with ErrorResponse
```

## 6. Względy bezpieczeństwa

### 6.1 Public Access
- **Brak autentykacji**: Health check musi być dostępny publicznie
- **Brak wrażliwych danych**: Response zawiera tylko status i czas
- **No sensitive information**: Nie ujawnia informacji o systemie

### 6.2 Information Disclosure
- **Minimal response**: Tylko `status: "ok"` i `time`
- **No system details**: Brak informacji o wersji, konfiguracji
- **No database schema**: Brak szczegółów o strukturze DB

### 6.3 Rate Limiting
- **Brak rate limiting**: Health check musi być zawsze dostępny
- **Load balancer friendly**: Może być wywoływany często
- **Monitoring friendly**: Używany przez external monitoring

### 6.4 Error Message Security
- **Generic error messages**: Nie ujawnia szczegółów błędów
- **No stack traces**: Brak informacji o implementacji
- **Safe error codes**: Standardowe HTTP status codes

```typescript
// ❌ ZŁE - ujawnia szczegóły
{ error: "PostgreSQL connection failed: connection timeout after 30s" }

// ✅ DOBRE - generic message
{ error: "Health check failed" }
```

## 7. Obsługa błędów

### 7.1 Scenariusze błędów i kody statusu

#### 500 Internal Server Error - System Failures

**Przypadki:**
1. Database connection timeout
2. Database authentication failed
3. Supabase service unavailable
4. Network connectivity issues
5. Unhandled exceptions

**Response:**
```typescript
{
  error: {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Health check failed',
    details: 'Database connection failed' // Generic message
  }
}
```

**Handler:**
```typescript
try {
  // Database check
  const { error } = await supabase.from('profiles').select('id').limit(1);
  
  if (error) {
    console.error('Health check failed - database error:', error);
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Health check failed',
          details: 'Database connection failed'
        }
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
} catch (error) {
  console.error('Health check failed - system error:', error);
  return new Response(
    JSON.stringify({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Health check failed',
        details: 'System error'
      }
    }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
```

**Logging**: Logujemy wszystkie błędy do console dla monitoring systems

### 7.2 Error Logging Strategy

**Do application logs** (console):
- ✅ Database connection errors
- ✅ System errors
- ✅ Response times
- ✅ Health check frequency

**Do monitoring systems**:
- ✅ Health check status (up/down)
- ✅ Response time metrics
- ✅ Error rate tracking

**NIE logujemy**:
- ❌ Request details (IP, user agent)
- ❌ Stack traces w production
- ❌ Sensitive configuration

### 7.3 Graceful Degradation

**Scenariusz**: Database jest niedostępny
- **Działanie**: Zwróć 500 z clear error message
- **Monitoring**: Alert systems otrzymają status "down"

**Scenariusz**: Partial system failure
- **Działanie**: Zwróć 500 (health check jest binary: up/down)
- **Logging**: Log szczegóły dla debugging

## 8. Rozważania dotyczące wydajności

### 8.1 Wąskie gardła

1. **Database Query** ⚠️ GŁÓWNE WĄSKIE GARDŁO
   - Czas: 10-50ms dla prostego SELECT
   - Throughput: Ograniczony przez Supabase connection pool
   - Koszt: Minimalny (prosty query)

2. **Response Generation**
   - JSON serialization: <1ms
   - Timestamp generation: <1ms

3. **Network Latency**
   - Local: <1ms
   - Production: 5-20ms

### 8.2 Optymalizacje

#### 8.2.1 Database Query Optimization

**Minimal Query:**
```typescript
// ✅ DOBRE - minimal query
const { error } = await supabase
  .from('profiles')
  .select('id')
  .limit(1);

// ❌ ZŁE - niepotrzebnie skomplikowane
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', 'some-id');
```

**Query Timeout:**
```typescript
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);

try {
  const { error } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .abortSignal(controller.signal);
    
  clearTimeout(timeoutId);
} catch (error) {
  clearTimeout(timeoutId);
  throw error;
}
```

#### 8.2.2 Response Optimization

**Minimal Response Size:**
```typescript
// Response: ~50 bytes
{
  "status": "ok",
  "time": "2025-10-15T10:30:00.000Z"
}
```

**No Compression Needed**: Response jest za mały, żeby compression miał sens

#### 8.2.3 Caching Considerations

**Cache Health Check?** ❌ NIE
- Health check musi być real-time
- Cache może ukryć rzeczywiste problemy
- Monitoring systems oczekują aktualnego statusu

**Cache-Control Headers:**
```typescript
headers: {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}
```

### 8.3 Monitoring Metrics

**Application Metrics:**
```typescript
const startTime = Date.now();

// ... health check logic

const duration = Date.now() - startTime;
console.log(`Health check completed in ${duration}ms`);
```

**Metrics to track:**
- Health check response time (p50, p95, p99)
- Health check success rate (should be >99.9%)
- Database connection time
- Error rate by type

**Alerting Thresholds:**
- Response time > 1s → Warning (slow database)
- Error rate > 1% → Critical (system issues)
- Health check down → Critical (immediate alert)

### 8.4 Load Testing Scenarios

**Scenario 1: Normal Load**
- 100 requests/second
- Expected: p95 < 100ms, error rate < 0.1%

**Scenario 2: High Load**
- 1000 requests/second
- Expected: p95 < 200ms, error rate < 0.5%

**Scenario 3: Database Degraded**
- Simulate slow database (5s response)
- Expected: Health check returns 500, monitoring alerts

## 9. Kroki implementacji

### Krok 1: Stworzenie API Route Handler

**Plik**: `src/pages/api/v1/health.ts`

```typescript
import type { APIRoute } from 'astro';
import type { HealthDTO, ErrorResponse } from '@/types';

/**
 * GET /api/v1/health
 * Health check endpoint for monitoring system status
 */
export const GET: APIRoute = async ({ locals }) => {
  const startTime = Date.now();

  try {
    // STEP 1: Database connectivity check
    // Using head: true to avoid transferring data for this high-frequency endpoint
    const { error: dbError } = await locals.supabase
      .from('profiles')
      .select('id', { head: true })
      .limit(1);

    if (dbError) {
      console.error('Health check failed - database error:', dbError);
      
      const duration = Date.now() - startTime;
      console.log(`Health check failed after ${duration}ms`);
      
      return new Response(
        JSON.stringify({
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Health check failed',
            details: 'Database connection failed'
          }
        } satisfies ErrorResponse),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        }
      );
    }

    // STEP 2: Generate success response
    const response: HealthDTO = {
      status: 'ok',
      time: new Date().toISOString()
    };

    const duration = Date.now() - startTime;
    console.log(`Health check completed in ${duration}ms`);

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Response-Time': duration.toString()
        }
      }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Health check failed after ${duration}ms:`, error);

    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Health check failed',
          details: 'System error'
        }
      } satisfies ErrorResponse),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  }
};

// Disable prerendering for API route
export const prerender = false;
```

---

### Krok 2: Testy jednostkowe

**Plik**: `src/pages/api/v1/health.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './health';

// Mock Astro context
const createMockContext = (supabaseMock: any) => ({
  locals: {
    supabase: supabaseMock
  }
});

describe('GET /api/v1/health', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    };
  });

  it('should return 200 OK when database is healthy', async () => {
    // Mock successful database query
    mockSupabase.limit.mockResolvedValue({ error: null });

    const context = createMockContext(mockSupabase);
    const response = await GET(context as any);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    
    // Verify database query was called
    expect(mockSupabase.from).toHaveBeenCalledWith('profiles');
    expect(mockSupabase.select).toHaveBeenCalledWith('id');
    expect(mockSupabase.limit).toHaveBeenCalledWith(1);
  });

  it('should return 500 when database connection fails', async () => {
    // Mock database error
    mockSupabase.limit.mockResolvedValue({ 
      error: { message: 'Connection timeout' } 
    });

    const context = createMockContext(mockSupabase);
    const response = await GET(context as any);
    
    expect(response.status).toBe(500);
    
    const data = await response.json();
    expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(data.error.message).toBe('Health check failed');
    expect(data.error.details).toBe('Database connection failed');
  });

  it('should return 500 when system error occurs', async () => {
    // Mock system error
    mockSupabase.limit.mockRejectedValue(new Error('System error'));

    const context = createMockContext(mockSupabase);
    const response = await GET(context as any);
    
    expect(response.status).toBe(500);
    
    const data = await response.json();
    expect(data.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(data.error.message).toBe('Health check failed');
    expect(data.error.details).toBe('System error');
  });

  it('should include proper cache headers', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    const context = createMockContext(mockSupabase);
    const response = await GET(context as any);
    
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    expect(response.headers.get('Expires')).toBe('0');
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should include response time header', async () => {
    mockSupabase.limit.mockResolvedValue({ error: null });

    const context = createMockContext(mockSupabase);
    const response = await GET(context as any);
    
    const responseTime = response.headers.get('X-Response-Time');
    expect(responseTime).toBeDefined();
    expect(parseInt(responseTime!)).toBeGreaterThan(0);
  });
});
```

---

### Krok 3: Testy integracyjne

**Plik**: `tests/api/health.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('GET /api/v1/health', () => {
  const baseUrl = 'http://localhost:4321';

  it('should return 200 OK with valid response', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    
    const data = await response.json();
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('time');
    expect(data.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('should respond quickly', async () => {
    const startTime = Date.now();
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const duration = Date.now() - startTime;
    
    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(1000); // Should respond within 1 second
  });

  it('should include proper cache headers', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    
    expect(response.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('expires')).toBe('0');
  });

  it('should include response time header', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    
    const responseTime = response.headers.get('x-response-time');
    expect(responseTime).toBeDefined();
    expect(parseInt(responseTime!)).toBeGreaterThan(0);
  });

  it('should handle multiple concurrent requests', async () => {
    const requests = Array(10).fill(null).map(() => 
      fetch(`${baseUrl}/api/v1/health`)
    );
    
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    const data = await Promise.all(
      responses.map(r => r.json())
    );
    
    data.forEach(data => {
      expect(data.status).toBe('ok');
    });
  });
});
```

---

### Krok 4: Dokumentacja i deployment checklist

**Plik**: `.ai/health-implementation-checklist.md`

```markdown
# Health Check Implementation Checklist

## Development
- [x] API route handler implemented
- [x] Database connectivity check
- [x] Error handling for all scenarios
- [x] Proper HTTP headers (cache-control, content-type)
- [x] Response time logging
- [x] Unit tests for handler
- [x] Integration tests for endpoint
- [x] Manual testing with curl

## Configuration
- [ ] Verify Supabase connection in environment
- [ ] Test database accessibility
- [ ] Verify response time < 1 second

## Security
- [ ] No sensitive information in response
- [ ] Generic error messages
- [ ] No stack traces in production
- [ ] Proper cache headers (no-cache)

## Performance
- [ ] Response time < 100ms (p95)
- [ ] Database query optimized (minimal SELECT)
- [ ] No unnecessary processing
- [ ] Load testing completed

## Monitoring
- [ ] Health check endpoint accessible
- [ ] Response time metrics logged
- [ ] Error rate tracking
- [ ] Alerting configured for failures

## Production Deployment
- [ ] Endpoint accessible at /api/v1/health
- [ ] Load balancer health check configured
- [ ] Monitoring system configured
- [ ] Error tracking configured
- [ ] Documentation updated

## Post-Deployment
- [ ] Health check returns 200 OK
- [ ] Response time < 100ms
- [ ] No errors in logs
- [ ] Monitoring alerts working
- [ ] Load balancer health checks passing
```

---

### Krok 5: Monitoring i alerting setup

**Plik**: `monitoring/health-check.yml` (przykład dla Prometheus)

```yaml
# Health check monitoring configuration
health_check:
  endpoint: "/api/v1/health"
  interval: "30s"
  timeout: "10s"
  
  # Success criteria
  success_status: 200
  success_response: '{"status":"ok"}'
  
  # Alerting rules
  alerts:
    - name: "HealthCheckDown"
      condition: "health_check_status != 1"
      severity: "critical"
      message: "Health check endpoint is down"
      
    - name: "HealthCheckSlow"
      condition: "health_check_duration > 1"
      severity: "warning"
      message: "Health check response time > 1s"
      
    - name: "HealthCheckErrorRate"
      condition: "rate(health_check_errors[5m]) > 0.01"
      severity: "warning"
      message: "Health check error rate > 1%"
```

---

## 10. Podsumowanie implementacji

### Utworzone pliki:
1. `src/pages/api/v1/health.ts` - główny handler API
2. `src/pages/api/v1/health.test.ts` - testy jednostkowe
3. `tests/api/health.test.ts` - testy integracyjne
4. `.ai/health-implementation-checklist.md` - checklist deployment

### Kluczowe cechy implementacji:
- ✅ Public endpoint (brak autentykacji)
- ✅ Szybka odpowiedź (<100ms)
- ✅ Database connectivity check
- ✅ Proper error handling
- ✅ Cache headers (no-cache)
- ✅ Response time logging
- ✅ Type-safe z TypeScript
- ✅ Comprehensive testing
- ✅ Monitoring ready

### Następne kroki:
1. Przetestuj endpoint z różnymi scenariuszami
2. Skonfiguruj monitoring i alerting
3. Zintegruj z load balancer
4. Deploy do production
5. Monitor performance metrics

### Użycie w production:
```bash
# Health check dla load balancer
curl -f http://your-domain.com/api/v1/health

# Monitoring check
curl -w "@curl-format.txt" -o /dev/null -s http://your-domain.com/api/v1/health
```

**curl-format.txt:**
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```
