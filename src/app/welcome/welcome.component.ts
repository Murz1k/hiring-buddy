import { Component, OnInit } from '@angular/core';
import { ResumesService } from './resumes.service';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit {
  searchQuery;

  resumes = [];
  pageIndex = 1;
  pageSize = 10;
  total = 10;

  constructor(private resumesService: ResumesService) {
  }

  ngOnInit(): void {
  }

  onSearch(): void {
    this.resumesService.getResumes(this.searchQuery, this.pageIndex - 1, this.pageSize).pipe(
      tap(items => {
        this.total = items.totalCount;
        this.resumes = items.items;
      })
    ).subscribe();
  }

  onChangePage($event: number) {
    this.resumesService.getResumes(this.searchQuery, this.pageIndex - 1, this.pageSize).pipe(
      tap(items => {
        this.total = items.totalCount;
        this.resumes = items.items;
      })
    ).subscribe();
  }
}
