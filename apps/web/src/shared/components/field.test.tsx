import { InputField, SelectField, TextareaField } from '@bora/ui';
import { render, screen } from '@testing-library/react';

describe('Field components', () => {
  it('associates the label with the input and the error via aria-describedby', () => {
    render(<InputField error="Geçersiz e-posta" label="E-posta" />);

    const input = screen.getByLabelText('E-posta');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const error = screen.getByText('Geçersiz e-posta');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  it('links hint text via aria-describedby when there is no error', () => {
    render(<InputField hint="En az 8 karakter olmalı." label="Şifre" type="password" />);

    const input = screen.getByLabelText('Şifre');
    expect(input).toHaveAttribute('aria-invalid', 'false');

    const hint = screen.getByText('En az 8 karakter olmalı.');
    expect(input).toHaveAttribute('aria-describedby', hint.id);
  });

  it('supports select and textarea fields', () => {
    render(
      <>
        <SelectField label="Şehir">
          <option>İstanbul</option>
        </SelectField>
        <TextareaField error="Zorunlu alan" label="Açık Adres" />
      </>,
    );

    expect(screen.getByLabelText('Şehir').tagName).toBe('SELECT');

    const textarea = screen.getByLabelText('Açık Adres');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });
});
