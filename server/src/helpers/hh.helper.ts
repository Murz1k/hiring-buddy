import { tryNavigate } from '../puppeteer-extension';
import { Page } from 'puppeteer';

const cheerio = require('cheerio');

export class HhHelper {
  constructor() {
  }

  async getResumeList(page: Page, request: GetResumeListRequest): Promise<{ totalPages: number, resumes: any[] }> {
    const PAGE_URL = `https://hh.ru/search/resume`;

    const requestString = Object.entries(request).map(([key, value]) => `${key}=${value}`).join('&');

    const pageUrl = `${PAGE_URL}?${requestString}`;

    await tryNavigate(page, pageUrl);

    const content = await page.content();
    const $ = cheerio.load(content);
    const totalPages = $('.pager-item-not-in-short-range a.bloko-button').slice(-1).text();

    const resumes = $('[data-qa=\'resume-serp__resume-title\']').get().map(resume => {
        const resumeId = $(resume).attr('href').split('?')[0].split('/').slice(-1).join('');
        const title = $(resume).text();
        return {
          resumeId,
          title
        };
      }
    );

    return {totalPages: +totalPages, resumes};
  }

  async getVacanciesList(page: Page, request: GetVacanciesListRequest): Promise<{ totalPages: number, vacancies: any[] }> {
    const PAGE_URL = `https://hh.ru/search/vacancy`;

    const requestString = Object.entries(request).map(([key, value]) => `${key}=${value}`).join('&');

    const pageUrl = `${PAGE_URL}?${requestString}`;

    await tryNavigate(page, pageUrl);

    const content = await page.content();
    const $ = cheerio.load(content);
    const totalPages = $($('[data-page]').get().slice(-2)[0]).text();

    const vacancies = $('[data-qa=\'vacancy-serp__vacancy-title\']').get().map(resume => {
        const id = $(resume).attr('href').split('?')[0].split('/').slice(-1).join('');
        const title = $(resume).text();
        return {
          id,
          title
        };
      }
    );

    return {totalPages: +totalPages, vacancies};
  }

  async getResumeById(page: Page, id: string): Promise<{id: string, title: string, fullName: string}> {
    await tryNavigate(page, `https://hh.ru/resume/${id}`);
    const content = await page.content();
    const $ = cheerio.load(content);

    const fullName = $('[data-qa=\'resume-personal-name\'] span').text();
    const title = $('[data-qa=\'resume-block-title-position\'] span').text();

    return {id, title, fullName};
  }

  async getVacancyById(page: Page, id: string): Promise<{id: string, skills: string[]}> {
    await tryNavigate(page, `https://hh.ru/vacancy/${id}`);
    const content = await page.content();
    const $ = cheerio.load(content);

    const skills = $('[data-qa=\'bloko-tag__text\']').get().map(b => $(b).text());
    return {id, skills};
  }
}

export interface GetVacanciesListRequest {
  text: string;
  experience?: string;
  employment?: string;
  schedule?: string;
  page: number;
}

export interface GetResumeListRequest {
  clusters: true;
  exp_period: 'all_time';
  area: number;
  logic: 'normal';
  no_magic: false;
  order_by: 'relevance';
  pos: 'full_text';
  text: string;
  experience?: string;
  employment?: string;
  schedule?: string;
  page: number;
}
