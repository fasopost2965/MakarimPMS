// Substitution de placeholders {{cle}} — utilitaire pur, même discipline
// que reservations/utils/pricing.ts. Volontairement minimal (pas de moteur
// de template complet type Handlebars) : les templates restent de simples
// phrases éditables par l'Administrateur, pas des documents avec logique
// conditionnelle.
export function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key)
      ? variables[key]
      : match,
  );
}
