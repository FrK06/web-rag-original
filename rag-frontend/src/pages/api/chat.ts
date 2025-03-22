// src/pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const API_URL = process.env.API_URL || 'http://localhost:8000';
    const response = await axios.post(`${API_URL}/api/chat/`, req.body);
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ message: 'Error connecting to API server' });
  }
}

//ORIGINAL

// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
//import type { NextApiRequest, NextApiResponse } from "next";

//type Data = {
//  name: string;
//};

//export default function handler(
//  req: NextApiRequest,
//  res: NextApiResponse<Data>,
//) {
//  res.status(200).json({ name: "John Doe" });
//}
