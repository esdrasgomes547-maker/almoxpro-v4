import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extrairSKU(input: string): string {
  const raw = input.trim();
  // Formato 1: URL completa com ?sku=
  try {
    const url = new URL(raw);
    const sku = url.searchParams.get("sku");
    if (sku) return sku.trim().toUpperCase();
  } catch { }
  // Formato 2: só o SKU direto (GLP-3446, ITEM-08460)
  // Remove qualquer caractere inválido e retorna só o SKU
  const match = raw.match(/([A-Z]+-\d+)/i);
  if (match) return match[1].toUpperCase();
  // Formato 3: retorna o que vier, limpo
  return raw.replace(/[^a-zA-Z0-9\-_]/g, "").toUpperCase();
}
