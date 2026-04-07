import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MEMORY_ROOT = process.env.MEMORY_ROOT || '/Users/sid/git/ai-team/.memory';
// path.resolve()로 정규화하여 인접 디렉토리 우회 취약점 방지
// 예: MEMORY_ROOT='.memory' → 인접 '.memoryx/'가 startsWith('.memory') 통과하는 버그 차단
const RESOLVED_ROOT = path.resolve(MEMORY_ROOT);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const segments = (await params).path;
    const relativePath = segments.map(decodeURIComponent).join('/');
    const fullPath = path.join(MEMORY_ROOT, relativePath);

    // 경로 탈출 방지 — path.resolve()로 정규화 후 path.sep 포함 접두사 검사
    // startsWith(MEMORY_ROOT) 단독 사용 시 인접 디렉토리('.memoryx/')도 통과하는 취약점 차단
    const resolvedFull = path.resolve(fullPath);
    if (!resolvedFull.startsWith(RESOLVED_ROOT + path.sep) && resolvedFull !== RESOLVED_ROOT) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: 'Is a directory' }, { status: 400 });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');

    return NextResponse.json({
      path: relativePath,
      content,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const segments = (await params).path;
    const relativePath = segments.map(decodeURIComponent).join('/');
    const fullPath = path.join(MEMORY_ROOT, relativePath);

    // 경로 탈출 방지 — path.resolve()로 정규화 후 path.sep 포함 접두사 검사
    const resolvedFull = path.resolve(fullPath);
    if (!resolvedFull.startsWith(RESOLVED_ROOT + path.sep) && resolvedFull !== RESOLVED_ROOT) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body as { content?: string };

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // 부모 디렉토리가 없으면 생성
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
    const stat = fs.statSync(fullPath);

    return NextResponse.json({
      path: relativePath,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
