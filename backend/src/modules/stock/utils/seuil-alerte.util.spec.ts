import { estSousSeuilAlerte } from './seuil-alerte.util';

describe('estSousSeuilAlerte', () => {
  it('renvoie true quand la quantité est strictement sous le seuil', () => {
    expect(
      estSousSeuilAlerte({ quantiteDisponible: 10, seuilAlerte: 40 }),
    ).toBe(true);
  });

  it('renvoie true quand la quantité est exactement égale au seuil (BR-STK-002 : <=)', () => {
    expect(
      estSousSeuilAlerte({ quantiteDisponible: 40, seuilAlerte: 40 }),
    ).toBe(true);
  });

  it('renvoie false quand la quantité est strictement au-dessus du seuil', () => {
    expect(
      estSousSeuilAlerte({ quantiteDisponible: 41, seuilAlerte: 40 }),
    ).toBe(false);
  });

  it('renvoie true pour une quantité à zéro (rupture totale)', () => {
    expect(estSousSeuilAlerte({ quantiteDisponible: 0, seuilAlerte: 40 })).toBe(
      true,
    );
  });
});
