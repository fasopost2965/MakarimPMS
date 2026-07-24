import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsPanel, TabsTrigger } from './tabs';

describe('Tabs — CH-032 (composant partagé, dette Lot 0)', () => {
  it('affiche uniquement le panneau actif et bascule au clic', () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">Onglet A</TabsTrigger>
          <TabsTrigger value="b">Onglet B</TabsTrigger>
        </TabsList>
        <TabsPanel value="a">Contenu A</TabsPanel>
        <TabsPanel value="b">Contenu B</TabsPanel>
      </Tabs>,
    );

    expect(screen.getByText('Contenu A')).toBeInTheDocument();
    expect(screen.queryByText('Contenu B')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Onglet B' }));

    expect(screen.getByText('Contenu B')).toBeInTheDocument();
    expect(screen.queryByText('Contenu A')).not.toBeInTheDocument();
  });
});
