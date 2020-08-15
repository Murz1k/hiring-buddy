import { HttpService, Injectable } from '@nestjs/common';
import { Order } from '../orders/order.entity';
import { Browser, Page } from 'puppeteer';

const cheerio = require('cheerio');
import { createBrowser, createPage, tryNavigate } from '../puppeteer-extension';
import { BehaviorSubject, forkJoin, from, iif, interval, of, Subject } from 'rxjs';
import { bufferCount, filter, first, map, pluck, scan, share, shareReplay, switchMap, take, tap, withLatestFrom } from 'rxjs/operators';

const MAX_PAGES = 4;
const MAX_BROWSERS = 4;

interface Resume {
  id: string;
  title: string;
  fullName: string;
}

@Injectable()
export class ResumesService {

  private resumes$: BehaviorSubject<Resume[]> = new BehaviorSubject<Resume[]>([]);

  private resources: { browser: Browser, page: Page }[] = [];
  private busyResources: { browser: Browser, page: Page }[] = [];

  private cacheBufferSubject = new Subject<Resume[]>();

  getResource$ = interval(100).pipe(
    filter(() => !!this.resources.length),
    take(1),
    map(() => {
      const res = this.resources.shift();
      this.busyResources.push(res);
      return res;
    }),
    // shareReplay()
  );

  cacheResume$ = this.cacheBufferSubject.pipe(
    bufferCount(5),
    scan((acc, curr) => [...acc, ...curr[0]], []),
    tap(this.resumes$),
    share()
  );

  constructor() {
    this.init();

    this.cacheResume$.subscribe();
  }

  async init(): Promise<void> {
    // TODO Использовать https://hackernoon.com/tips-and-tricks-for-web-scraping-with-puppeteer-ed391a63d952
    const browsers$ = from(this.createBrowsers(MAX_BROWSERS));
    const pages$ = (browser) => from(this.createPages(MAX_PAGES, browser)).pipe(
      map((pages: Page[]) => pages.map(page => ({page, browser})))
    );

    browsers$.pipe(
      switchMap(browsers => forkJoin(browsers.map(browser => pages$(browser)))),
      tap(resources => {
        this.resources = resources.reduce((curr, acc) => acc.concat(curr), []);
      })
    ).subscribe();
  }

  getAll(): Promise<Order[]> {
    return Promise.all([]);
  }

  /**
   * Возвращает все проекты с сайта https://fl.ru по заданным фильтрам
   * @param search Объект с фильтрами
   */
  getResumes = async (search: { words: string | string[] | any, pageIndex: number, pageSize: number, minBudget?: number, isDebug?: boolean | string, maxBudget?: number, withoutContractor?: boolean }): Promise<{ items: Resume[], totalCount?: number }> => {

    if (this.resumes$.value.length >= search.pageSize) {
      return {
        items: this.resumes$.value.slice(search.pageIndex, search.pageSize),
        totalCount: this.resumes$.value.length
      };
    }

    try {
      let pageUrl = 'https://hh.ru/search/resume';
      const text = 'angular';
      const experience = ''; // 'between1And3';
      const employment = ''; // 'full';
      const schedule = ''; // 'fullDay';

      pageUrl += `?clusters=true&exp_period=all_time&area=1&logic=normal&no_magic=false&order_by=relevance&pos=full_text&text=${text}&experience=${experience}&employment=${employment}&schedule=${schedule}`;
      console.log(pageUrl);

      const resource = await this.getFreeResource();
      console.log(`Свободно: ${this.resources.length} Занято: ${this.busyResources.length}`);
      const page = resource.page;
      await tryNavigate(page, pageUrl);

      const content = await page.content();
      this.clearResource(resource);

      const $ = cheerio.load(content);
      const totalPages = $('.pager-item-not-in-short-range a.bloko-button').slice(-1).text();
      const skills: Resume[] = await this.parsingResumesPage(0, pageUrl);

      this.cacheBufferSubject.next(skills);

      console.log(`Всего страниц: ${totalPages}`);

      for (let i = 1; i < +totalPages; i++) {
        from(this.parsingResumesPage(i, pageUrl)).pipe(
          tap(resumes => this.cacheBufferSubject.next(resumes))
        ).subscribe();
      }

      return {
        items: skills.slice(search.pageIndex, search.pageSize),
        totalCount: +totalPages * 20
      };

    } catch (e) {
      console.error(e.message);
      console.log(`${new Date().toLocaleString()}: Ошибочка`);
      return {
        error: e.message
      };
    } finally {
    }
  };

  /**
   * Возвращает все проекты с сайта https://fl.ru по заданным фильтрам
   * @param search Объект с фильтрами
   */
  getVacancies = async (search: { words: string | string[] | any, minBudget?: number, isDebug?: boolean | string, maxBudget?: number, withoutContractor?: boolean }): Promise<{ items: any[] }> => {

    try {
      // TODO Использовать https://hackernoon.com/tips-and-tricks-for-web-scraping-with-puppeteer-ed391a63d952
      if (!this._browser) {
        this._browser = await createBrowser();
      }
      let pageUrl = 'https://hh.ru/search/vacancy';
      const text = 'angular';
      const experience = ''; // 'between1And3';
      const employment = ''; // 'full';
      const schedule = ''; // 'fullDay';

      pageUrl += `?text=${text}&experience=${experience}&employment=${employment}&schedule=${schedule}`;

      const page = await createPage(this._browser, true);
      await tryNavigate(page, pageUrl);

      const totalPages = await page.evaluate(() => {
        // @ts-ignore
        return +Array.from(document.querySelectorAll('[data-page]')).splice(-2).map(p => p.innerText)[0];
      });

      console.log(`Всего страниц: ${totalPages}`);

      let skills = [];
      for (let pageIndex = 0; pageIndex < +totalPages; pageIndex++) {
        console.log(`${new Date().toLocaleString()}: Скрабим страницу ${pageIndex}`);
        if (pageIndex) {
          await tryNavigate(page, pageUrl += `&page=${pageIndex}`);
        }

        const vacancyIds = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('[data-qa=\'vacancy-serp__vacancy-title\']')).map(vacancy => {
            // @ts-ignore
            return vacancy.href.split('?')[0].split('/').slice(-1).join('');
          });
        });
        const temp = [];

        try {
          // @ts-ignore
          for (let i = 0; i < vacancyIds.length; i += MAX_PAGES) {
            const ids = vacancyIds.splice(i, MAX_PAGES);
            temp.push([ids]);
          }
        } catch (e) {

        }
        const skillArrays = [];
        try {
          for (let i = 0; i < temp.length; i++) {
            for (let j = 0; j < temp[i].length; j++) {
              const newSkills = await Promise.all(temp[i][j].map(vacancy => this._getSkillsByVacancyId(vacancy)));
              console.log(newSkills);
              skillArrays.push(...newSkills);
            }
          }
        } catch (e) {
          console.log(e);
        }

        skills = [...skills, ...skillArrays];
      }

      const temp1 = skills
        .reduce((acc, curr) => [...acc, ...curr], [])
        .map(i => i.toLowerCase())
        .reduce((acc, curr) => !acc.has(curr) ? acc.set(curr, 1) : acc.set(curr, acc.get(curr) + 1), new Map())
        .entries()
      ;

      // skills = skills.entries();

      const temp2 = Array.from(temp1).sort((a, b) => {
        if (a[1] > b[1]) {
          return -1;
        }
        if (a[1] < b[1]) {
          return 1;
        }
        // a должно быть равным b
        return 0;
      });

      console.log(temp2.slice(0, 20));
      return {
        items: temp2
      };
    } catch (e) {
      console.error(e.message);
      console.log(`${new Date().toLocaleString()}: Ошибочка`);
      return {
        error: e.message
      };
    } finally {
    }
  };

  /**
   * Возвращает все проекты с сайта https://fl.ru по заданным фильтрам
   * @param search Объект с фильтрами
   */
  getTopSkills = async (search: { words: string | string[] | any, minBudget?: number, isDebug?: boolean | string, maxBudget?: number, withoutContractor?: boolean }): Promise<any> => {

    try {
      // TODO Использовать https://hackernoon.com/tips-and-tricks-for-web-scraping-with-puppeteer-ed391a63d952
      if (!this._browser) {
        this._browser = await createBrowser();
      }
      let pageUrl = 'https://hh.ru/search/vacancy';
      const text = 'angular';
      const experience = ''; // 'between1And3';
      const employment = ''; // 'full';
      const schedule = ''; // 'fullDay';

      pageUrl += `?text=${text}&experience=${experience}&employment=${employment}&schedule=${schedule}`;

      const page = await createPage(this._browser, true);
      await tryNavigate(page, pageUrl);

      const totalPages = await page.evaluate(() => {
        // @ts-ignore
        return +Array.from(document.querySelectorAll('[data-page]')).splice(-2).map(p => p.innerText)[0];
      });

      console.log(`Всего страниц: ${totalPages}`);

      let skills = [];
      for (let pageIndex = 0; pageIndex < +totalPages; pageIndex++) {
        console.log(`${new Date().toLocaleString()}: Скрабим страницу ${pageIndex}`);
        if (pageIndex) {
          await tryNavigate(page, pageUrl += `&page=${pageIndex}`);
        }

        const vacancyIds = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('[data-qa=\'vacancy-serp__vacancy-title\']')).map(vacancy => {
            // @ts-ignore
            return vacancy.href.split('?')[0].split('/').slice(-1).join('');
          });
        });
        const temp = [];

        try {
          // @ts-ignore
          for (let i = 0; i < vacancyIds.length; i += MAX_PAGES) {
            const ids = vacancyIds.splice(i, MAX_PAGES);
            temp.push([ids]);
          }
        } catch (e) {

        }
        const skillArrays = [];
        try {
          for (let i = 0; i < temp.length; i++) {
            for (let j = 0; j < temp[i].length; j++) {
              const newSkills = await Promise.all(temp[i][j].map(vacancy => this._getSkillsByVacancyId(vacancy)));
              skillArrays.push(...newSkills);
            }
          }
        } catch (e) {

        }

        skills = [...skills, ...skillArrays];
      }

      const temp1 = skills
        .reduce((acc, curr) => [...acc, ...curr], [])
        .map(i => i.toLowerCase())
        .reduce((acc, curr) => !acc.has(curr) ? acc.set(curr, 1) : acc.set(curr, acc.get(curr) + 1), new Map())
        .entries()
      ;

      // skills = skills.entries();

      const temp2 = Array.from(temp1).sort((a, b) => {
        if (a[1] > b[1]) {
          return -1;
        }
        if (a[1] < b[1]) {
          return 1;
        }
        // a должно быть равным b
        return 0;
      });

      console.log(temp2.slice(0, 20));
      return {};
    } catch (e) {
      console.error(e.message);
      console.log(`${new Date().toLocaleString()}: Ошибочка`);
      return {
        error: e.message
      };
    } finally {
    }
  };

  private async _getSkillsByVacancyId(vacancyId: string): Promise<string[]> {
    const page = await createPage(this._browser, true);
    // let obj;
    // if (pages.length < MAX_PAGES) {
    //   pages.push({page: await createPage(this._browser, true), free: true});
    // } else {
    //   obj = pages.find(i => i.free);
    //   obj.free = false;
    // }
    await tryNavigate(page, `https://krasnodar.hh.ru/vacancy/${vacancyId}`);
    const result = await page.evaluate(() => {
      // @ts-ignore
      return Array.from(document.querySelectorAll('[data-qa=\'bloko-tag__text\']')).map(b => b.innerText);
    });

    setTimeout(() => page.close(), 5000);

    // obj.free = true;

    return result;
  }

  private async _getResumeById(resumeId: string): Promise<Resume> {
    const resource = await this.getFreeResource();
    await tryNavigate(resource.page, `https://krasnodar.hh.ru/resume/${resumeId}`);
    const content = await resource.page.content();
    this.clearResource(resource);
    console.log(`Читаем контент: ${resumeId}`);
    const $ = cheerio.load(content);

    const fullName = $('[data-qa=\'resume-personal-name\'] span').text();
    const title = $('[data-qa=\'resume-block-title-position\'] span').text();

    const obj = {id: resumeId, title, fullName} as Resume;

    this.cacheBufferSubject.next([obj]);

    return obj;
  }

  private async parsingResumesPage(pageIndex = 0, pageUrl: string): Promise<Resume[]> {
    console.log(`${new Date().toLocaleString()}: Скрабим страницу ${pageIndex}`);

    const resource = await this.getFreeResource();
    await tryNavigate(resource.page, pageUrl += `&page=${pageIndex}`);
    const content = await resource.page.content();
    this.clearResource(resource);
    const $ = cheerio.load(content);

    const shortResume = $('[data-qa=\'resume-serp__resume-title\']').get().map(resume => {
        const resumeId = $(resume).attr('href').split('?')[0].split('/').slice(-1).join('');
        const title = $(resume).text();
        return {
          resumeId,
          title
        };
      }
    );

    let skillArrays: Resume[] = [];
    try {
      skillArrays = await Promise.all(
        shortResume
          .filter(resume =>
            this.OROperators(resume.title, 'developer', 'программист', 'разработчик', 'developer')
            && this.NOTOperators(resume.title, 'php', 'верстальщик', 'ruby', 'junior', 'стажер', 'vue', 'react')
          ).map(resume => this._getResumeById(resume.resumeId))
      );
    } catch (e) {
      console.log(e);
    }

    return skillArrays.reduce((acc: Resume[], curr) => acc.concat(curr), []);
  }

  private NOTOperators(field: string, ...args: string[]): boolean {
    return args.some(a => field.toLowerCase().indexOf(a.toLowerCase()) < 0);
  }

  private ANDOperators(field: string, ...args: string[]): boolean {
    return args.some(a => field.toLowerCase().indexOf(a.toLowerCase()) > -1);
  }

  private OROperators(field: string, ...args: string[]): boolean {
    return args.some(a => field.toLowerCase().indexOf(a.toLowerCase()) > -1);
  }

  private async createBrowsers(count: number = 1): Promise<Browser[]> {
    const browsers = [];
    for (let j = 0; j < count; j++) {
      browsers.push(await createBrowser());
    }
    return browsers;
  }

  private async createPages(count: number = 1, browser: Browser): Promise<Page[]> {
    const pages = [];
    for (let j = 0; j < count; j++) {
      pages.push(await createPage(browser, true));
    }
    return pages;
  }

  private getFreeResource(): Promise<any> {
    // console.log(`Свободно: ${this.resources.length} Занято: ${this.busyResources.length}`);
    return this.getResource$.toPromise();
  }

  private clearResource(resource: any): void {
    this.busyResources = this.busyResources.filter(r => r !== resource);
    this.resources.push(resource);
    // console.log(`Свободно: ${this.resources.length} Занято: ${this.busyResources.length}`);
  }
}
