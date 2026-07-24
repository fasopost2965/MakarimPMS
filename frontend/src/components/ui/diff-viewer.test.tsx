import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer } from './diff-viewer';

describe('DiffViewer — CH-032 (composant partagé, dette Lot 0)', () => {
  it('affiche les valeurs avant/après pour chaque champ modifié', () => {
    render(
      <DiffViewer
        before={{ statut: 'EMISE', montantTotal: '450.00' }}
        after={{ statut: 'ANNULEE_PAR_AVOIR', montantTotal: '450.00' }}
      />,
    );

    expect(screen.getByText('statut')).toBeInTheDocument();
    expect(screen.getByText('EMISE')).toBeInTheDocument();
    expect(screen.getByText('ANNULEE_PAR_AVOIR')).toBeInTheDocument();
    // montantTotal identique des deux côtés : une seule occurrence rendue
    // (pas dupliquée visuellement en "changé"), la valeur apparaît deux
    // fois dans les colonnes Avant/Après mais avec le même style neutre.
    expect(screen.getAllByText('450.00')).toHaveLength(2);
  });

  it("détecte un champ ajouté (absent du côté 'avant')", () => {
    render(<DiffViewer before={{ a: '1' }} after={{ a: '1', b: '2' }} />);
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('se replie sur un affichage brut si avant/après ne sont pas des objets', () => {
    render(<DiffViewer before="ancienne-valeur" after="nouvelle-valeur" />);
    expect(screen.getByText('ancienne-valeur')).toBeInTheDocument();
    expect(screen.getByText('nouvelle-valeur')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
