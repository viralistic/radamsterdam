"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { api } from "@/lib/utils";

interface Demo {
  password: string;
  code: string;
  accounts: { email: string; name: string; role: string; org: string }[];
}

export function LoginForm({ demo }: { demo: Demo | null }) {
  const router = useRouter();
  const [step, setStep] = React.useState<"password" | "mfa">("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/pro/session", { method: "POST", json: { email, password } });
      setStep("mfa");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/pro/session/mfa", { method: "POST", json: { code } });
      router.push("/pro");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col gap-8 px-4 py-8 sm:px-10">
        <Logo suffix="Professionals" />
        <div className="mx-auto grid w-full max-w-sm flex-1 content-center gap-6">
          <div className="grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{step === "password" ? "Inloggen op het dashboard" : "Bevestig dat jij het bent"}</h1>
            <p className="text-sm text-muted-foreground">
              {step === "password"
                ? "Voor medewerkers van gemeente, handhaving, politie en hulpverlening."
                : "Vul de zescijferige code uit je authenticator-app in."}
            </p>
          </div>
          {step === "password" ? (
            <form onSubmit={submitPassword} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-mailadres van je organisatie</Label>
                <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <KeyRound />} Verder
              </Button>
            </form>
          ) : (
            <form onSubmit={submitCode} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="code">Verificatiecode</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center font-mono text-lg tracking-[0.4em]"
                  autoFocus
                  required
                />
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              <Button type="submit" disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Inloggen
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setStep("password"); setCode(""); setError(null); }}>
                Ander account gebruiken
              </Button>
            </form>
          )}
          {demo && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Demo-accounts</CardTitle>
                <CardDescription>
                  Wachtwoord <span className="font-mono">{demo.password}</span>, verificatiecode <span className="font-mono">{demo.code}</span>. Elke rol ziet andere gegevens.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1">
                {demo.accounts.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(demo.password);
                      setStep("password");
                    }}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.role}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.org}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">Gebruik</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <div className="hidden flex-col justify-end gap-4 bg-muted p-10 lg:flex">
        <p className="max-w-md text-2xl font-semibold tracking-tight text-balance">
          Van losse signalen naar aantoonbare actie in je wijk.
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          Je ziet alleen de meldingen waarvoor je organisatie bevoegd is. Inzage in gevoelige dossiers en elke export worden vastgelegd in het auditlog.
        </p>
      </div>
    </div>
  );
}
