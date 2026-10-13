/* Karlin-Stolin synagogues for the "navigate to the nearest synagogue" button.
   To add one: copy a block, fill the name and address lines, and put approximate coordinates
   (they only decide which synagogue is nearest; the navigation app itself searches by `q`, the full address). */
window.SHULS = [
  { name: 'בית כנסת קרלין', lines: ["רח' האתרוג 89", 'שכונת פרי הארץ - גבעת זאב'], q: 'האתרוג 89, גבעת זאב', lat: 31.8586, lon: 35.1685 },
  { name: 'בית הכנסת היכל דרבינו יוחנן', lines: ['אבינועם ילין 11', 'ירושלים'], q: 'אבינועם ילין 11, ירושלים', lat: 31.7892, lon: 35.2208 }
];
