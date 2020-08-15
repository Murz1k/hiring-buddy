import {Browser, Page} from 'puppeteer';
import * as puppeteer from 'puppeteer';
// import {default as axios} from 'axios';
// import * as cheerio from 'cheerio';

/**
 * Набор текста в предварительно очищенную строку
 * @param page Страница с текстовым полем
 * @param selector Селектор текстового поля
 * @param text Текст который нужно набрать
 */
export const typeText = async (page: Page, selector: string, text: string): Promise<void> => {
    try {
        await page.waitForSelector(selector, {timeout: 1000});
        await page.$eval(selector, (el: HTMLInputElement) => el.value = '');
        await page.type(selector, text);
    } catch (e) {
        console.log(`Селектор ${selector} не найден.`);
    }
};

/**
 * Проверяет наличие элемента в DOM
 * @param page Страница поиска элемента
 * @param selector Селектор элемента
 * @param timeout
 */
export const isExist = async (page: Page, selector: string, timeout?: number): Promise<boolean> => {
    try {
        await page.waitForSelector(selector, {timeout: timeout || 1000});
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Переход по ссылке
 * @param page Страница для перехода
 * @param pageUrl Ссылка для перехода
 * @param isDynamic
 */
export const tryNavigate = async (page: Page, pageUrl: string, isDynamic: boolean = true): Promise<void> => {
    try {
        // Попробуем перейти по URL
        // console.log(`${new Date().toLocaleString()}: Открываю страницу: ${pageUrl}`);

        if (page.url() === pageUrl) {
            return;
        }

        // if (isDynamic) {
        await Promise.all([
            page.goto(pageUrl, {waitUntil: 'networkidle2', })
            , page.waitForNavigation({waitUntil: 'networkidle2'})
        ]);
        // } else {
        //     const cookies = await page.cookies();
        //     const {data} = await axios.get(pageUrl, {
        //         headers: {Cookie: cookies.map(i => `${i.name}:${i.value}`).join('; ')},
        //         withCredentials: true
        //     });

        // (page as any).$ = cheerio.load(data);

        // await page.setContent(data);
        // }

    } catch (error) {
        console.log(`${new Date().toLocaleString()}: Не удалось открыть страницу: ${pageUrl} из-за ошибки: ${error}`);
        await page.close();
    }
};

export const createBrowser = (isDebug?: boolean): Promise<Browser> => {
    return puppeteer.launch({
        headless: !isDebug, // options.isDebug != 'true',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920x1080'
        ]
    });
};

export const createPage = async (browser: Browser, withoutAssets?: boolean): Promise<Page> => {
    const page = await browser.newPage();
    if (withoutAssets) {
        const blockedResourceTypes = [
            'image',
            'media',
            'font',
            'texttrack',
            'object',
            'beacon',
            'csp_report',
            'imageset',
        ];

        const skippedResources = [
            'quantserve',
            'adzerk',
            'doubleclick',
            'adition',
            'exelator',
            'sharethrough',
            'cdn.api.twitter',
            'google-analytics',
            'googletagmanager',
            // 'google', // Нужно для рекапчи гугла, без этого не работает кнопка логина
            'fontawesome',
            'facebook',
            'analytics',
            'optimizely',
            'clicktale',
            'mixpanel',
            'zedo',
            'clicksor',
            'mc.yandex.ru',
            '.mail.ru',
            'tiqcdn',
        ];
        try {
            await page.setRequestInterception(true);
            page.on('request', request => {
                const requestUrl = request.url().split('?')[0].split('#')[0];
                if (
                    blockedResourceTypes.indexOf(request.resourceType()) !== -1 ||
                    skippedResources.some(resource => requestUrl.indexOf(resource) !== -1)
                    // Be careful with above
                    || request.url().includes('.jpg')
                    || request.url().includes('.jpeg')
                    || request.url().includes('.png')
                    || request.url().includes('.gif')
                    || request.url().includes('.css')
                ) {
                    request.abort();
                }
                else {
                    request.continue();
                }
            });
        } catch (e) {

        }
    }
    return page;
};
