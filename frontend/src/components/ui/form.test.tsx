import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './form';

describe('FormField — CH-032 (composant partagé, dette Lot 0)', () => {
  it('associe le label au contrôle via htmlFor/id', () => {
    render(
      <FormField id="nom" label="Nom">
        <input id="nom" />
      </FormField>,
    );
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
  });

  it('affiche un indicateur visuel quand le champ est obligatoire', () => {
    render(
      <FormField id="nom" label="Nom" required>
        <input id="nom" />
      </FormField>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it("affiche le message d'erreur avec role=alert quand error est fourni", () => {
    render(
      <FormField id="nom" label="Nom" error="Le nom est obligatoire.">
        <input id="nom" />
      </FormField>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Le nom est obligatoire.',
    );
  });

  it("affiche l'aide (hint) uniquement en l'absence d'erreur", () => {
    const { rerender } = render(
      <FormField id="nom" label="Nom" hint="Nom légal complet">
        <input id="nom" />
      </FormField>,
    );
    expect(screen.getByText('Nom légal complet')).toBeInTheDocument();

    rerender(
      <FormField
        id="nom"
        label="Nom"
        hint="Nom légal complet"
        error="Obligatoire"
      >
        <input id="nom" />
      </FormField>,
    );
    expect(screen.queryByText('Nom légal complet')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Obligatoire');
  });
});
