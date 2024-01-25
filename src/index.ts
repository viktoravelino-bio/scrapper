import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { join } from 'path';
import axios from 'axios';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import * as beautify from 'js-beautify';

const openai = new OpenAI({
    apiKey: '',
});

const url = 'https://mui.com/joy-ui/react-button/';
const target = 'button';

const chunkString = (str: string, length: number): string[] => {
    const chunks: string[] = [];
    let pos = 0;
    const strLength = str.length;

    while (pos < strLength) {
        chunks.push(str.substring(pos, Math.min(pos + length, strLength)));
        pos += length;
    }

    return chunks;
};

const cleanHtml = (html: string): string => {
    // Function to clean HTML (e.g., remove excessive whitespace, scripts, etc.)
    return html.replace(/\s+/g, ' ').trim();
};

const fetchAndProcessHtml = async (url: string): Promise<void> => {
    try {
        const response = await axios.get<string>(url);
        const html = response.data;
        const $ = cheerio.load(html);

        $('body script').remove();
        let mainHtml = $('main').html() ?? ''; // Provide a fallback for nullish values
        // Clean the HTML
        mainHtml = cleanHtml(mainHtml);
        // Beautify the HTML
        const beautifiedHtml = beautify.html(mainHtml, {
            indent_size: 2,
        });

        // Chunk the HTML
        const htmlChunks = chunkString(beautifiedHtml, 4000);
        // console.log('HTML Chunks:', htmlChunks);

        htmlChunks.forEach(async (chunk) => {
            try {
                await checkHTML(chunk).then((response) => {
                    console.log('Response:', response.choices[0].message);
                });
            } catch (error) {
                console.error('Error fetching URL:', error);
            }
        });
    } catch (error) {
        console.error('Error fetching URL:', error);
    }
};

fetchAndProcessHtml(url);

const checkHTML = async (html: string) => {
    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-1106',
        // model: 'gpt-4-1106-preview',
        messages: [
            {
                role: 'system',
                content:
                    'You are a helpful code debugger. You are an expert at helping users find elements in the DOM based on their instructions. You will receive HTML and you are to find all DOM elements that you think might match the type of element they\'re looking for. If they ask you to find all "button" elements, you would look for all button tags, but also look at the class names and ids of all elements and see if they indicate a button. For example, mui components may have the classes "MuiButton-root" and "MuiButton-variantSolid" among others. Other components libraries and custom elements will have their own. Use your best judgement and return an array of matching tags and query selectors.  It is VERY important that you only return an json that identifies matching tags and selectors. If you return anything else, the user will be very confused and will not be able to complete their task. This is the desired format: { "tags": ["button"], "selectors": [".MuiButton-root", ".MuiButton-variantSolid"] }',
            },
            {
                role: 'user',
                content: `Please find all elements of this type ${target} in this html: ${html}`,
            },
        ],
        temperature: 1,
        max_tokens: 256,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: { type: 'json_object' },
    });

    return response;
};
async function asyncFilter<T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => Promise<boolean>
) {
    return Promise.all(array.map(predicate)).then((results) =>
        array.filter((_v, index) => results[index])
    );
}

(async () => {
    console.log('Removing old images...');
    fs.readdirSync(join(__dirname, 'images')).forEach((file) => {
        if (file.endsWith('.png')) {
            fs.unlinkSync(join(__dirname, 'images', file));
        }
    });
    console.log('✅ Done removing old images');

    console.log('Initiating puppeteer browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.goto(url);
    await page.setViewport({ width: 1080, height: 1024 });

    await page.waitForFunction("document.readyState === 'complete'");

    // wait for all initial animations to finish
    console.log('🤔 Awaiting animations...');
    await new Promise((r) => setTimeout(r, 5000));

    console.log('📷  Taking screenshots...');
    const tagButtons = await page.$$('button');
    const classButtons = await page.$$('.button');
    const buttonsSet = new Set();

    // filter buttons that have no content
    const filtered = await asyncFilter([...classButtons, ...tagButtons], async (button) => {
        const hasContent =
            ((await button.evaluate((el) => el.textContent)) !== '' ||
                (await button.evaluate((el) => el.textContent))) !== ' ';

        if (!hasContent) {
            return false;
        }

        return true;
    });

    for (let i = 0; i < filtered.length; i++) {
        const button = filtered[i];
        const classes = (await button.evaluate((el) => el.classList.toString()))?.trim();
        const textContent = (await button.evaluate((el) => el.textContent))?.trim();

        // improve uniqueness
        const uniqueString = `${textContent} ${classes}`;

        // skip buttons that have already been screenshot
        if (buttonsSet.has(uniqueString) || !(await button.isVisible())) {
            continue;
        }

        buttonsSet.add(uniqueString);

        await button
            .screenshot({ path: join(__dirname, 'images', `button-${i}.png`) })
            .catch((err) => {
                console.log(
                    'Button not in page; "Might be a11n or in a modal or different viewport"'
                );
            });
    }

    await browser.close();

    console.log('✅ Done taking screenshots');
})();
