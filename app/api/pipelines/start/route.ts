import { NextRequest, NextResponse } from "next/server";
import { pipelineService } from "@/server/services/pipeline.service";


export async function POST(req: NextRequest) {

    try {

        const body = await req.json();

        const { folderUrl } = body;


        if(!folderUrl){
            return NextResponse.json(
                {
                    error:"Folder URL is required"
                },
                {
                    status:400
                }
            );
        }


        const jobData =
            await pipelineService.start(folderUrl);



        return NextResponse.json({
            success:true,
            jobId:jobData.jobId
        });


    } catch(error){
        console.log('pipeline start err',error)
        return NextResponse.json(
            {
                error:"Pipeline failed"
            },
            {
                status:500
            }
        );
    }

}