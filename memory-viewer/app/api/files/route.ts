import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { FileNode } from '@/lib/types';

const MEMORY_ROOT = process.env.MEMORY_ROOT || '/Users/sid/git/ai-team/.memory';

function buildTree(dirPath: string, relativePath: string = ''): FileNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    // .gitkeep, .db 파일 스킵
    if (entry.name.startsWith('.') || entry.name.endsWith('.db') ||
        entry.name.endsWith('.db-shm') || entry.name.endsWith('.db-wal')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = buildTree(fullPath, relPath);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children,
      });
    } else {
      const stat = fs.statSync(fullPath);
      nodes.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }

  // 디렉토리 먼저, 이름순 정렬
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function GET() {
  try {
    if (!fs.existsSync(MEMORY_ROOT)) {
      return NextResponse.json({ error: 'Memory root not found' }, { status: 404 });
    }
    const tree = buildTree(MEMORY_ROOT);
    return NextResponse.json(tree);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: relativePath, content = '' } = body as {
      path?: string;
      content?: string;
    };

    if (!relativePath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const fullPath = path.join(MEMORY_ROOT, relativePath);

    // 경로 탈출 방지
    if (!fullPath.startsWith(MEMORY_ROOT)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    if (fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File already exists' }, { status: 409 });
    }

    // 부모 디렉토리 생성
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, typeof content === 'string' ? content : '', 'utf-8');
    const stat = fs.statSync(fullPath);

    return NextResponse.json(
      {
        path: relativePath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
