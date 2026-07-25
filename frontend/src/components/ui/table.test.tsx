import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

describe('Table — CH-032 (composant partagé, dette Lot 0)', () => {
  it('rend une structure sémantique <table> avec en-têtes et cellules', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Article</TableHead>
            <TableHead>Quantité</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Serviettes</TableCell>
            <TableCell>12</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Article' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Quantité' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('cell', { name: 'Serviettes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '12' })).toBeInTheDocument();
  });
});
