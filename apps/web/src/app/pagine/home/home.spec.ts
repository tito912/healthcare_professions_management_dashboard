import { TestBed } from '@angular/core/testing';
import { Home } from './home';

describe('Home (segnaposto)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
    }).compileComponents();
  });

  it('mostra il titolo e il pulsante di verifica', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('h1')?.textContent).toContain('Gestionale Turni di Reparto');
    expect(elemento.querySelector('button')?.textContent).toContain(
      'Verifica il collegamento alle Functions',
    );
  });
});
