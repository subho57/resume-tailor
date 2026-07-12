// ============================================================================
// Best-effort, dependency-free JSON Schema (2020-12 subset) validator.
// Replicates the Ajv options we want — { allErrors, useDefaults, coerceTypes,
// strict:false } — without a network install:
//   - Collects ALL issues as warnings; NEVER throws on content problems.
//   - Applies `default` values to missing properties (useDefaults).
//   - Coerces obvious scalar mismatches, e.g. "10" -> 10 (coerceTypes).
//   - Honors `additionalProperties:false` (theme) as warnings, permissive elsewhere.
// This is intentionally a pragmatic subset covering the keywords our schemas use:
// type, properties, items, oneOf, enum, default, additionalProperties, format.
// ============================================================================

export interface Warning { path: string; message: string; }

type JSONValue = any;

const isObj = (v: any) => v !== null && typeof v === "object" && !Array.isArray(v);

function typeOf(v: any): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v; // "string" | "number" | "boolean" | "object"
}

function typeMatches(v: any, t: string): boolean {
  if (t === "integer") return typeof v === "number" && Number.isInteger(v);
  if (t === "number") return typeof v === "number";
  if (t === "array") return Array.isArray(v);
  if (t === "object") return isObj(v);
  return typeOf(v) === t;
}

// Attempt a scalar coercion toward one of the allowed types. Returns
// { changed, value }. Mirrors Ajv coerceTypes for the common LLM-output cases.
function coerce(v: any, types: string[]): { changed: boolean; value: any } {
  for (const t of types) {
    if (typeMatches(v, t)) return { changed: false, value: v };
  }
  // string -> number/integer
  if (typeof v === "string" && (types.includes("number") || types.includes("integer"))) {
    const n = Number(v);
    if (!Number.isNaN(n) && v.trim() !== "") {
      if (types.includes("integer") && !Number.isInteger(n)) return { changed: true, value: Math.trunc(n) };
      return { changed: true, value: n };
    }
  }
  // number -> string
  if (typeof v === "number" && types.includes("string")) return { changed: true, value: String(v) };
  // boolean-ish string -> boolean
  if (typeof v === "string" && types.includes("boolean")) {
    if (v === "true") return { changed: true, value: true };
    if (v === "false") return { changed: true, value: false };
  }
  return { changed: false, value: v };
}

/**
 * Validate `data` against `schema`, MUTATING data in place to apply defaults and
 * coercions. Returns collected warnings. Never throws for content violations.
 */
export function validate(schema: any, data: any, warnings: Warning[] = [], path = "$"): Warning[] {
  if (!schema || typeof schema !== "object") return warnings;

  // oneOf: pick the first matching branch by type; if none match, warn but keep data.
  if (Array.isArray(schema.oneOf)) {
    const branch = schema.oneOf.find((b: any) => {
      if (!b.type) return true;
      const types = Array.isArray(b.type) ? b.type : [b.type];
      return types.some((t: string) => typeMatches(data, t));
    });
    if (branch) return validate(branch, data, warnings, path);
    warnings.push({ path, message: `value did not match any oneOf branch` });
    return warnings;
  }

  // type check + coercion
  if (schema.type) {
    const types: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (data !== undefined && !types.some((t) => typeMatches(data, t))) {
      const c = coerce(data, types);
      if (c.changed) {
        // We can only rewrite scalars through the parent; caller handles object/array props.
        // Signal via a sentinel by mutating primitive wrappers is impossible, so we record
        // the coercion and let property/item loops below apply it. For root scalars we warn.
        warnings.push({ path, message: `coerced ${typeOf(data)} to ${typeof c.value}` });
        // best-effort: if this is a container we won't reach here.
        return warnings;
      } else {
        warnings.push({ path, message: `expected ${types.join("|")}, got ${typeOf(data)}` });
      }
    }
  }

  // enum
  if (Array.isArray(schema.enum) && data !== undefined) {
    if (!schema.enum.includes(data)) {
      warnings.push({ path, message: `value "${data}" not in enum [${schema.enum.join(", ")}]` });
    }
  }

  // format (advisory only)
  if (schema.format && typeof data === "string") {
    const ok = checkFormat(schema.format, data);
    if (!ok) warnings.push({ path, message: `value does not look like a valid ${schema.format}` });
  }

  // object: apply defaults, recurse into properties, honor additionalProperties
  if (isObj(schema.properties) && isObj(data)) {
    for (const [key, subRaw] of Object.entries<any>(schema.properties)) {
      const sub = subRaw as any;
      if (!(key in data) && sub && "default" in sub) {
        // deep-clone defaults so shared refs aren't mutated
        data[key] = JSON.parse(JSON.stringify(sub.default));
      }
      if (key in data) {
        const childPath = `${path}.${key}`;
        // scalar coercion applied here (so we can rewrite data[key])
        if (sub.type) {
          const types: string[] = Array.isArray(sub.type) ? sub.type : [sub.type];
          if (data[key] !== undefined && !types.some((t) => typeMatches(data[key], t))) {
            const c = coerce(data[key], types);
            if (c.changed) {
              warnings.push({ path: childPath, message: `coerced ${typeOf(data[key])} to ${typeof c.value}` });
              data[key] = c.value;
            }
          }
        }
        validate(sub, data[key], warnings, childPath);
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(data)) {
        if (!allowed.has(key)) warnings.push({ path: `${path}.${key}`, message: `unknown property (not allowed by theme schema)` });
      }
    } else if (isObj(schema.additionalProperties)) {
      const declared = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(data)) {
        if (!declared.has(key)) validate(schema.additionalProperties, data[key], warnings, `${path}.${key}`);
      }
    }
  }

  // array items
  if (schema.items && Array.isArray(data)) {
    data.forEach((el, i) => {
      // scalar coercion for array elements
      if (schema.items.type && !Array.isArray(schema.items.type)) {
        const t = schema.items.type;
        if (!typeMatches(el, t)) {
          const c = coerce(el, [t]);
          if (c.changed) { warnings.push({ path: `${path}[${i}]`, message: `coerced to ${t}` }); data[i] = c.value; }
        }
      }
      validate(schema.items, data[i], warnings, `${path}[${i}]`);
    });
  }

  return warnings;
}

function checkFormat(format: string, v: string): boolean {
  switch (format) {
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case "uri": return /^(https?|mailto|tel):/.test(v) || /^[a-z]+:\/\//i.test(v);
    case "date": return /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v);
    case "date-time": return !Number.isNaN(Date.parse(v));
    default: return true;
  }
}
