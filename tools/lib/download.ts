import fs = require('fs');
import { saveTransformed, readFile, saveRaw } from './local-io';

import { http } from './net';
import { tidyHTML, selectPart, decodeHtmlEntity, fixMultiSpanTag, removeExtraTag } from './html';
import { to_markdown } from './markdown';
import { filter_md } from './filters';

export interface DownloadSource {
    // 页面url
    url: string
    // CSS selector
    selector: string[]
}

/**
 * selector
 */
export interface DownloadItem {

    // 下载源
    source: [DownloadSource]

    /**
     * id: 决定保存的文件名
     * (如果没有，会从title生成一个能用作文件名的)
     */
    id?: string

    /**
     * 标题
     */
    title: string
    title_zh: string

    /**
     * prefix: 分类，用于生成保存路径
     */
    prefix: "HPL" | "TODO"
}

export type DownloadList = DownloadItem[];

/**
 * Item的保存文件名
 */
export function genFilename(item: DownloadItem) {
    return item.id || item.title.split(/[^0-9a-zA-Z]+/).join('-');
}

/**
 * Item的保存路径 (包括prefix)
 */
export function genFullname(item: DownloadItem) {
    return `${item.prefix || 'HPL'}/${genFilename(item)}`;
}

function rawPathFor(item: DownloadItem) {
    return `${__dirname}/../raw/${genFullname(item)}.html`;
}

/**
 * 下载文件 (已有时不会再次下载)
 */
export function downloadItem(item: DownloadItem): Promise<void> {
    const saveDest = rawPathFor(item);

    if (fs.existsSync(saveDest)) {
        return Promise.reject(`${saveDest} exists. not downloading`);
    }

    const parts = item.source.map((src) => {
        const content = http.get(src.url)
            .then(html => Promise.all(src.selector.map(s => selectPart(s)(html))))
            .then(selectedParts => selectedParts.join("\n\n\n"));
        return content;
    });

    return Promise.all(parts).then((parts_html) => parts_html.join("\n"))
        .then(decodeHtmlEntity)
        .then((html) => {
            saveRaw(item, html);
        });
}

export function convertedFileFor(item: DownloadItem) {
    return `${__dirname}/../../${genFullname(item)}.md`;
}

export function convertItem(item: DownloadItem): Promise<void> {
    const rawPath = rawPathFor(item);

    const saveDest = convertedFileFor(item);

    return readFile(rawPath)
        .then(to_markdown)
        .then(filter_md)
        .then((md) => saveTransformed(item, md));
}