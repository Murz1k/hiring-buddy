import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ResumesService {

  constructor(private http: HttpClient) {
  }

  getResumes(query: string, pageIndex: number, pageSize: number): Observable<any> {
    return this.http.get('/api/resumes', {params: {query, pageIndex: pageIndex.toString(), pageSize: pageSize.toString()}});
  }
}
