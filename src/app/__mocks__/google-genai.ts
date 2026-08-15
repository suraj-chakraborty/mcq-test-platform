export class GoogleGenAI {
  models = {
    generateContent: jest.fn().mockResolvedValue({
      text: 'READY',
    }),
  };
}

export default {
  GoogleGenAI,
};
