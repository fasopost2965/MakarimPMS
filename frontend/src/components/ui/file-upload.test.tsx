import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FileUpload } from './file-upload';

function makeFile(name: string) {
  return new File(['contenu'], name, { type: 'image/jpeg' });
}

describe('FileUpload — CH-032 (composant partagé, dette Lot 0)', () => {
  it("affiche l'invite par défaut quand aucun fichier n'est sélectionné", () => {
    render(
      <FileUpload value={null} onChange={vi.fn()} hint="JPEG/PNG, 8 Mo max" />,
    );
    expect(
      screen.getByText('Glissez un fichier ici, ou cliquez pour parcourir'),
    ).toBeInTheDocument();
    expect(screen.getByText('JPEG/PNG, 8 Mo max')).toBeInTheDocument();
  });

  it('affiche le nom du fichier une fois sélectionné', () => {
    const file = makeFile('cin.jpg');
    render(<FileUpload value={file} onChange={vi.fn()} />);
    expect(screen.getByText('cin.jpg')).toBeInTheDocument();
  });

  it('appelle onChange avec le fichier sélectionné via le champ natif', () => {
    const onChange = vi.fn();
    const { container } = render(
      <FileUpload id="doc" value={null} onChange={onChange} />,
    );
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = makeFile('passeport.png');
    fireEvent.change(input, { target: { files: [file] } });
    expect(onChange).toHaveBeenCalledWith(file);
  });

  it('appelle onChange avec le fichier déposé (glisser-déposer)', () => {
    const onChange = vi.fn();
    render(<FileUpload value={null} onChange={onChange} />);
    const dropzone = screen.getByRole('button');
    const file = makeFile('cin-verso.jpg');

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    });

    expect(onChange).toHaveBeenCalledWith(file);
  });
});
