import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { SecurityService } from "../services/security";

// Known vulnerability scanner & malicious bot user-agents
const MALICIOUS_USER_AGENTS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /masscan/i,
  /w3af/i,
  /zaproxy/i,
  /arachni/i,
  /nmap/i,
  /gobuster/i,
  /dirbuster/i,
  /hydra/i,
  /nuclei/i,
  /openvas/i,
  /havij/i,
];

// Dangerous path traversal patterns
const PATH_TRAVERSAL_PATTERN = /(?:\.\.[\\/]|%2e%2e[\\/]|[\\/]\.\.[\\/]|[\\/]\/etc\/passwd|[\\/]\/etc\/shadow|win\.ini|[\\/]\/proc\/self\/)/i;

// SQL injection exploit signatures
const SQL_INJECTION_PATTERN = /(?:\bunion\b\s+(?:all\s+)?select|\bselect\b\s+.*\bfrom\b\s+information_schema|\bwaitfor\s+delay\b|\bsleep\s*\(\s*\d+\s*\)|\bbenchmark\s*\(\s*\d+|\bdrop\s+table\b|\bexec\s*\(\s*xp_cmdshell|;\s*shutdown\b|'\s*or\s*'1'\s*=\s*'1|"\s*or\s*"1"\s*=\s*"1|'\s*or\s*1\s*=\s*1|"\s*or\s*1\s*=\s*1)/i;

// Malicious script payload signatures
const XSS_INJECTION_PATTERN = /(?:<script\b[^>]*>|javascript:\s*void|vbscript:|onload\s*=\s*["']?alert|onerror\s*=\s*["']?alert|document\.cookie\s*=)/i;

function inspectValueForThreats(val: unknown): { threat: boolean; attackType?: string; snippet?: string } {
  if (val === null || val === undefined) return { threat: false };

  if (typeof val === "string") {
    if (PATH_TRAVERSAL_PATTERN.test(val)) {
      return { threat: true, attackType: "PATH_TRAVERSAL", snippet: val.substring(0, 100) };
    }
    if (SQL_INJECTION_PATTERN.test(val)) {
      return { threat: true, attackType: "SQL_INJECTION", snippet: val.substring(0, 100) };
    }
    if (XSS_INJECTION_PATTERN.test(val)) {
      return { threat: true, attackType: "XSS_SCRIPT_PROBE", snippet: val.substring(0, 100) };
    }
  } else if (typeof val === "object") {
    for (const subVal of Object.values(val as Record<string, unknown>)) {
      const result = inspectValueForThreats(subVal);
      if (result.threat) return result;
    }
  }

  return { threat: false };
}

const securityFirewall: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip;
    const userAgent = request.headers["user-agent"] || "";
    const rawUrl = request.raw.url || "";

    // 1. Check IP Blacklist
    const blacklistStatus = SecurityService.isIpBlacklisted(ip);
    if (blacklistStatus.isBlacklisted) {
      return reply.status(403).send({
        error: "Access Denied",
        code: "IP_BLACKLISTED",
        message: `Your IP address is temporarily blocked due to malicious activity. Remaining: ${blacklistStatus.remainingSeconds}s.`,
      });
    }

    // 2. Check Malicious Scanner User-Agents
    for (const pattern of MALICIOUS_USER_AGENTS) {
      if (pattern.test(userAgent)) {
        await SecurityService.recordBlockedAttack(ip, "MALICIOUS_SCANNER_USER_AGENT", {
          userAgent,
          url: rawUrl,
          method: request.method,
        });

        return reply.status(403).send({
          error: "Forbidden",
          code: "AUTOMATED_SCANNER_BLOCKED",
          message: "Automated vulnerability scanners and malicious probes are strictly prohibited.",
        });
      }
    }

    // 3. Inspect URL and Query Parameters
    const urlThreat = inspectValueForThreats(rawUrl);
    if (urlThreat.threat) {
      await SecurityService.recordBlockedAttack(ip, urlThreat.attackType!, {
        source: "URL/Query",
        url: rawUrl,
        snippet: urlThreat.snippet,
        method: request.method,
      });

      return reply.status(403).send({
        error: "Forbidden",
        code: "MALICIOUS_PAYLOAD_REJECTED",
        message: "Malicious request signature detected and blocked by PropertyStack Security Shield.",
      });
    }

    // 4. Inspect Request Body Payloads (for POST, PUT, PATCH)
    if (request.body && typeof request.body === "object") {
      const bodyThreat = inspectValueForThreats(request.body);
      if (bodyThreat.threat) {
        await SecurityService.recordBlockedAttack(ip, bodyThreat.attackType!, {
          source: "RequestBody",
          url: rawUrl,
          snippet: bodyThreat.snippet,
          method: request.method,
        });

        return reply.status(403).send({
          error: "Forbidden",
          code: "MALICIOUS_PAYLOAD_REJECTED",
          message: "Malicious request payload detected and blocked by PropertyStack Security Shield.",
        });
      }
    }
  });
};

export default fp(securityFirewall, {
  name: "security-firewall",
});
