import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { Page } from '../models/page.model';
import { PlaceResponse } from '../models/place.model';
import { PlaceListComponent } from './place-list';

describe('PlaceListComponent', () => {
  let component: PlaceListComponent;
  let fixture: ComponentFixture<PlaceListComponent>;
  let httpMock: HttpTestingController;

  const page: Page<PlaceResponse> = {
    content: [
      {
        id: 1,
        label: 'Cafe',
        location: 'Main St',
        days: [
          { id: 10, dayOfWeek: 'wednesday', startTime: '11:30', endTime: '15:00', type: 'OPEN' }
        ]
      }
    ],
    totalElements: 1,
    totalPages: 1,
    number: 0,
    size: 20,
    first: true,
    last: true
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaceListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(PlaceListComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('loads the first page sorted by label and renders it', () => {
    const req = httpMock.expectOne((r) => r.url.endsWith('/v1/place'));
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('sort')).toBe('label,asc');

    req.flush(page);
    fixture.detectChanges();

    expect(component.places().length).toBe(1);
    expect(component.total()).toBe(1);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Cafe');
    // The weekly grouping renders the day label and its intervals separately.
    expect(text).toContain('Wed');
    expect(text).toContain('11:30–15:00');
  });

  it('goes back to the first page when the sort changes', () => {
    httpMock.expectOne((r) => r.url.endsWith('/v1/place')).flush(page);

    component.onPage({ pageIndex: 2, pageSize: 10, length: 30 });
    httpMock.expectOne((r) => r.params.get('page') === '2').flush({ ...page, number: 2 });

    component.onSort({ active: 'location', direction: 'desc' });
    const req = httpMock.expectOne((r) => r.params.get('sort') === 'location,desc');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('10');
    req.flush(page);
  });
});
