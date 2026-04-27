export const calendarHref = "https://cal.com/product@casedra.cloud/demo";
export const demoRoute = "/book-demo";
export const generalEmail = "product@casedra.cloud";
export const generalEmailHref = `mailto:${generalEmail}`;
export const emailHref = `mailto:${generalEmail}?subject=Demostraci%C3%B3n%20Casedra`;
export const founderSectionId = "founders";

// Sustituir estos fundadores temporales antes de un lanzamiento más amplio.
export const founderContacts = [
  {
    firstName: "Clara",
    name: "Clara Martín",
    role: "Cofundadora · Implantación",
    summary:
      "Para pilotos, puesta en marcha y cómo arrancar con una primera oficina.",
    email: "clara@casedra.cloud",
    href: "mailto:clara@casedra.cloud?subject=Casedra%20-%20Implantaci%C3%B3n",
  },
  {
    firstName: "Javier",
    name: "Javier Ortega",
    role: "Cofundador · Producto",
    summary: "Para canales, reparto de contactos y encaje del producto.",
    email: "javier@casedra.cloud",
    href: "mailto:javier@casedra.cloud?subject=Casedra%20-%20Producto",
  },
] as const;
