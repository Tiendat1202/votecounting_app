# Security Considerations

## CSRF Protection

This API uses cookie-based authentication with JWT tokens. While CodeQL flags the lack of CSRF protection, the following measures mitigate CSRF risks:

1. **SameSite Cookie Attribute**: Cookies are set with `SameSite=Lax` which provides CSRF protection for most scenarios. This prevents cookies from being sent in cross-site requests except for top-level navigation.

2. **CORS Configuration**: The API has strict CORS configuration that only allows requests from `http://localhost:3000` (or the configured origin). This prevents unauthorized domains from making requests to the API.

3. **HttpOnly Cookies**: Cookies are set with the `HttpOnly` flag, preventing JavaScript access and mitigating XSS-based CSRF attacks.

### Production Recommendations

For production deployments, consider implementing additional CSRF protection:

1. **CSRF Tokens**: Implement CSRF tokens using libraries like `csurf` or custom token validation
2. **SameSite=Strict**: Use `SameSite=Strict` for even stronger CSRF protection (with potential UX trade-offs)
3. **Custom Headers**: Require custom headers (e.g., `X-Requested-With: XMLHttpRequest`) that cannot be set in simple cross-origin requests

## Rate Limiting

The API implements rate limiting on all endpoints:

- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **File uploads**: 10 uploads per hour per IP  
- **General API endpoints**: 100 requests per 15 minutes per IP

## Input Validation

All user inputs are validated:

- Session IDs are validated as positive integers
- Filenames are sanitized to prevent path traversal attacks
- File contents are verified using magic bytes (not just MIME types)

## Password Security

- Passwords are hashed using bcrypt with 10 salt rounds
- Default admin password should be changed in production

## Database Security

- All database queries use parameterized queries to prevent SQL injection
- Database credentials should be stored in environment variables

## File Upload Security

- File size is limited to 10MB
- Only image files (JPEG, PNG, GIF) are allowed
- MIME types are validated
- File content is verified using magic bytes with the `file-type` library
- Filenames are sanitized to prevent directory traversal

## Security Summary

**No critical vulnerabilities detected in the implementation.**

### Known Considerations:
1. **CSRF Protection**: Relies on SameSite cookies and CORS. Consider adding CSRF tokens for production.
2. **Default Admin Credentials**: The default admin user should be removed or have its password changed in production.
3. **Rate Limiting**: Implemented on all routes to prevent abuse.

### Recommendations for Production:
1. Use HTTPS in production (set `secure: true` for cookies)
2. Change default admin credentials
3. Implement CSRF tokens for state-changing operations
4. Use environment variables for all secrets
5. Set up proper logging and monitoring
6. Consider implementing account lockout after failed login attempts
7. Implement password complexity requirements
