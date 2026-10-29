/* Generation settings: which categories, which auth, which Postman variable names. */
import type { KeyboardEvent } from "react";
import type { AuthMode, AuthSettings, Options, VarKey, VarNames } from "../../core/types";

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur(); };

const INCLUDE: [keyof Options, string][] = [
  ["positive", "Happy paths"],
  ["negative", "Validation errors"],
  ["boundary", "Boundary values"],
  ["security", "Auth checks"],
  ["nulls", "Null values"],
  ["contentType", "Wrong content type"],
];

export function IncludeFieldset({ opts, onChange }: { opts: Options; onChange: (o: Options) => void }) {
  return (
    <fieldset>
      <legend>Include</legend>
      {INCLUDE.map(([k, label]) => (
        <label className="chk" key={k}>
          <input type="checkbox" checked={opts[k]} onChange={(e) => onChange({ ...opts, [k]: e.target.checked })} /> {label}
        </label>
      ))}
    </fieldset>
  );
}

const MODES: [AuthMode, string][] = [
  ["contract", "Use the contract's security schemes"],
  ["bearer", "Bearer token"],
  ["apikey", "API key"],
  ["basic", "Basic auth"],
  ["oauth2", "OAuth 2.0 access token"],
  ["none", "No auth"],
];

export function AuthFieldset({ auth, onChange, info }: { auth: AuthSettings; onChange: (a: AuthSettings) => void; info: string }) {
  return (
    <fieldset>
      <legend>Authorization</legend>
      <div className="row">
        <select aria-label="Authorization type" value={auth.mode} onChange={(e) => onChange({ ...auth, mode: e.target.value as AuthMode })}>
          {MODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        {auth.mode === "apikey" && (
          <span className="row" style={{ margin: 0 }}>
            {/* commit on blur, like the original change event, so typing doesn't regenerate per keystroke */}
            <input key={auth.apiKeyName} defaultValue={auth.apiKeyName} aria-label="API key name" size={12}
              onBlur={(e) => e.target.value !== auth.apiKeyName && onChange({ ...auth, apiKeyName: e.target.value })} onKeyDown={blurOnEnter} />
            <select aria-label="API key location" value={auth.apiKeyIn} onChange={(e) => onChange({ ...auth, apiKeyIn: e.target.value as "header" | "query" })}>
              <option value="header">in header</option>
              <option value="query">in query</option>
            </select>
          </span>
        )}
      </div>
      <div className="hint">{info}</div>
    </fieldset>
  );
}

const VARS: [VarKey, string][] = [
  ["baseUrl", "Base URL"],
  ["token", "Token"],
  ["apiKey", "API key"],
  ["username", "Username"],
  ["password", "Password"],
];

export function VariablesFieldset({ vars, onChange }: { vars: VarNames; onChange: (v: VarNames) => void }) {
  return (
    <fieldset>
      <legend>Postman variable names</legend>
      <div className="row">
        {VARS.map(([k, label]) => (
          <label className="chk" key={k}>
            {label}{" "}
            <input defaultValue={vars[k]} size={12} aria-label={`${label} variable name`}
              onBlur={(e) => e.target.value !== vars[k] && onChange({ ...vars, [k]: e.target.value })} onKeyDown={blurOnEnter} />
          </label>
        ))}
      </div>
      <div className="hint">
        Used as <code>{"{{name}}"}</code> in the generated requests and the collection's Variables tab. Letters, digits and underscores only.
      </div>
    </fieldset>
  );
}
